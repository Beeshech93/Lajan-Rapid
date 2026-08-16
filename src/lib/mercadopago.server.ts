// Conector Mercado Pago — verificación de webhooks y sincronización de pagos.
// Credenciales guardadas manualmente desde el panel de administración
// (o por variables de entorno del mismo nombre).

export const MP_CRED_NAMES = [
  "MERCADOPAGO_ACCESS_TOKEN",
  "MERCADOPAGO_WEBHOOK_SECRET",
] as const;

export type MpCredName = (typeof MP_CRED_NAMES)[number];

const MP_API = "https://api.mercadopago.com";

export async function loadMpCreds(): Promise<Record<string, string>> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("integration_credentials")
      .select("name, value")
      .in("name", [...MP_CRED_NAMES]);
    const out: Record<string, string> = {};
    for (const row of data ?? []) if (row.value) out[row.name] = row.value;
    return out;
  } catch (e) {
    console.error("No se pudieron leer las credenciales de Mercado Pago", e);
    return {};
  }
}

export async function saveMpCred(name: string, value: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!value) {
    await supabaseAdmin.from("integration_credentials").delete().eq("name", name);
    return;
  }
  await supabaseAdmin
    .from("integration_credentials")
    .upsert({ name, value, updated_at: new Date().toISOString(), updated_by: userId });
}

function pick(stored: Record<string, string>, name: MpCredName) {
  return process.env[name] ?? stored[name];
}

export async function mpStatusInfo() {
  const stored = await loadMpCreds();
  return {
    hasAccessToken: Boolean(pick(stored, "MERCADOPAGO_ACCESS_TOKEN")),
    hasWebhookSecret: Boolean(pick(stored, "MERCADOPAGO_WEBHOOK_SECRET")),
    tokenName: "MERCADOPAGO_ACCESS_TOKEN" as const,
    secretName: "MERCADOPAGO_WEBHOOK_SECRET" as const,
  };
}

function timingSafeEqualHex(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacSha256Hex(secret: string, message: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verifica la firma `x-signature` de Mercado Pago.
 * Manifest oficial: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 */
export async function verifyMpSignature(opts: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
}): Promise<{ ok: boolean; reason?: string }> {
  const stored = await loadMpCreds();
  const secret = pick(stored, "MERCADOPAGO_WEBHOOK_SECRET");
  if (!secret) return { ok: false, reason: "Falta MERCADOPAGO_WEBHOOK_SECRET" };
  if (!opts.signatureHeader) return { ok: false, reason: "Falta la cabecera x-signature" };

  const parts = Object.fromEntries(
    opts.signatureHeader.split(",").map((p) => {
      const [k, ...rest] = p.split("=");
      return [(k ?? "").trim(), rest.join("=").trim()];
    }),
  ) as Record<string, string>;

  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return { ok: false, reason: "Firma malformada" };

  // Rechaza reintentos muy antiguos (10 minutos).
  const tsMs = Number(ts) * (ts.length > 10 ? 1 : 1000);
  if (Number.isFinite(tsMs) && Math.abs(Date.now() - tsMs) > 10 * 60 * 1000) {
    return { ok: false, reason: "Firma expirada" };
  }

  const manifest = `id:${opts.dataId ?? ""};request-id:${opts.requestId ?? ""};ts:${ts};`;
  const expected = await hmacSha256Hex(secret, manifest);
  return timingSafeEqualHex(expected, v1)
    ? { ok: true }
    : { ok: false, reason: "Firma inválida" };
}

export type MpPayment = {
  id: string;
  status: string;
  status_detail?: string;
  external_reference?: string | null;
  transaction_amount?: number;
  currency_id?: string;
};

/** Consulta el pago real en la API de Mercado Pago (nunca se confía en el body). */
export async function fetchMpPayment(paymentId: string): Promise<MpPayment | null> {
  const stored = await loadMpCreds();
  const token = pick(stored, "MERCADOPAGO_ACCESS_TOKEN");
  if (!token) {
    console.error("Mercado Pago: falta MERCADOPAGO_ACCESS_TOKEN");
    return null;
  }
  const res = await fetch(`${MP_API}/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.error(`Mercado Pago: consulta de pago ${paymentId} falló [${res.status}]`);
    return null;
  }
  const p = (await res.json()) as MpPayment;
  return { ...p, id: String(p.id) };
}

type TransferStatus = "paid" | "awaiting_payment" | "cancelled";

function mapStatus(mpStatus: string): TransferStatus | null {
  switch (mpStatus) {
    case "approved":
      return "paid";
    case "pending":
    case "in_process":
    case "authorized":
      return "awaiting_payment";
    case "rejected":
    case "cancelled":
    case "refunded":
    case "charged_back":
      return "cancelled";
    default:
      return null;
  }
}

const STATUS_TEXT: Record<TransferStatus, { title: string; body: string }> = {
  paid: { title: "Pago confirmado", body: "Recibimos tu pago y ya estamos procesando el envío." },
  awaiting_payment: { title: "Pago pendiente", body: "Tu pago está en proceso de confirmación." },
  cancelled: { title: "Pago no completado", body: "El pago fue rechazado o cancelado." },
};

/**
 * Aplica el resultado del pago al envío correspondiente
 * (se enlaza por `external_reference` = referencia del envío).
 */
export async function applyMpPayment(payment: MpPayment) {
  const ref = payment.external_reference?.trim();
  if (!ref) return { ok: false, reason: "El pago no trae external_reference" };

  const next = mapStatus(payment.status);
  if (!next) return { ok: false, reason: `Estado no manejado: ${payment.status}` };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: transfer } = await supabaseAdmin
    .from("transfers")
    .select("id, user_id, status, reference")
    .eq("reference", ref)
    .maybeSingle();

  if (!transfer) return { ok: false, reason: `No existe el envío ${ref}` };
  if (transfer.status === next) return { ok: true, unchanged: true, transferId: transfer.id };
  if (["completed", "ready_for_pickup", "processing"].includes(transfer.status)) {
    return { ok: true, unchanged: true, transferId: transfer.id };
  }

  const { error } = await supabaseAdmin
    .from("transfers")
    .update({ status: next })
    .eq("id", transfer.id);
  if (error) {
    console.error("Mercado Pago: no se pudo actualizar el envío", error);
    return { ok: false, reason: error.message };
  }

  const text = STATUS_TEXT[next];
  await supabaseAdmin.from("notifications").insert({
    user_id: transfer.user_id,
    title: `${text.title} · ${transfer.reference}`,
    body: text.body,
  });

  return { ok: true, transferId: transfer.id, status: next };
}

/**
 * Crea una preferencia de pago en Mercado Pago.
 * Retorna el `init_point` (URL de checkout) o null si falla.
 */
export async function createMpPreference(opts: {
  transferId: string;
  reference: string;
  amount: number;
  currency: string;
  description: string;
  buyerEmail?: string;
  successUrl?: string;
  pendingUrl?: string;
  failureUrl?: string;
}) {
  const stored = await loadMpCreds();
  const token = pick(stored, "MERCADOPAGO_ACCESS_TOKEN");
  if (!token) {
    console.error("Mercado Pago: falta MERCADOPAGO_ACCESS_TOKEN");
    return null;
  }

  const preference = {
    items: [
      {
        id: opts.reference,
        title: opts.description,
        quantity: 1,
        unit_price: opts.amount,
        currency_id: opts.currency === "MXN" ? "MXN" : opts.currency === "USD" ? "USD" : "ARS",
      },
    ],
    external_reference: opts.reference,
    notification_url: `${process.env['PUBLIC_URL'] || "http://localhost:5173"}/api/public/mercadopago/webhook`,
    back_urls: {
      success: opts.successUrl || `${process.env['PUBLIC_URL'] || "http://localhost:5173"}/transferencia/${opts.transferId}?payment=success`,
      pending: opts.pendingUrl || `${process.env['PUBLIC_URL'] || "http://localhost:5173"}/transferencia/${opts.transferId}?payment=pending`,
      failure: opts.failureUrl || `${process.env['PUBLIC_URL'] || "http://localhost:5173"}/transferencia/${opts.transferId}?payment=failure`,
    },
    payer: opts.buyerEmail ? { email: opts.buyerEmail } : undefined,
    auto_return: "approved" as const,
  };

  try {
    const res = await fetch(`${MP_API}/checkout/preferences`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preference),
    });

    if (!res.ok) {
      console.error(`Mercado Pago: no se pudo crear preferencia [${res.status}]`, await res.text());
      return null;
    }

    const data = (await res.json()) as { init_point?: string; id?: string };
    return data.init_point || null;
  } catch (e) {
    console.error("Mercado Pago: error creando preferencia", e);
    return null;
  }
}
