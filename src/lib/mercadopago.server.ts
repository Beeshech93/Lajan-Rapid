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
  /** Restringe el checkout a tarjeta (excluye efectivo y transferencias). */
  cardOnly?: boolean;
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

/* ------------------------------------------------------------------ *
 * OXXO — generación de ficha de pago en efectivo (voucher real)
 * ------------------------------------------------------------------ */

export type OxxoVoucher = {
  paymentId: string;
  /** Código de barras / referencia que el cliente dicta en la caja OXXO. */
  reference: string;
  /** URL del comprobante imprimible generado por Mercado Pago. */
  voucherUrl: string | null;
  /** Vencimiento en ISO-8601. */
  expiresAt: string | null;
  amount: number;
  currency: string;
  status: string;
};

function mapOxxo(p: Record<string, unknown>): OxxoVoucher {
  const td = (p["transaction_details"] ?? {}) as Record<string, unknown>;
  const barcode = (p["barcode"] ?? {}) as Record<string, unknown>;
  const ref =
    (typeof barcode["content"] === "string" && barcode["content"]) ||
    (typeof td["payment_method_reference_id"] === "string" && td["payment_method_reference_id"]) ||
    (typeof td["verification_code"] === "string" && td["verification_code"]) ||
    String(p["id"]);
  return {
    paymentId: String(p["id"]),
    reference: String(ref),
    voucherUrl:
      typeof td["external_resource_url"] === "string" ? (td["external_resource_url"] as string) : null,
    expiresAt: typeof p["date_of_expiration"] === "string" ? (p["date_of_expiration"] as string) : null,
    amount: Number(p["transaction_amount"] ?? 0),
    currency: String(p["currency_id"] ?? "MXN"),
    status: String(p["status"] ?? "pending"),
  };
}

/** Busca una ficha OXXO vigente ya emitida para esta referencia de envío. */
async function findExistingOxxo(token: string, reference: string): Promise<OxxoVoucher | null> {
  const url = `${MP_API}/v1/payments/search?external_reference=${encodeURIComponent(reference)}&sort=date_created&criteria=desc&limit=10`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const json = (await res.json()) as { results?: Record<string, unknown>[] };
  for (const p of json.results ?? []) {
    if (p["payment_method_id"] !== "oxxo") continue;
    if (p["status"] !== "pending") continue;
    const v = mapOxxo(p);
    if (v.expiresAt && new Date(v.expiresAt).getTime() < Date.now()) continue;
    return v;
  }
  return null;
}

/**
 * Crea (o reutiliza) una ficha real de pago en OXXO vía Mercado Pago.
 * No se guardan datos de tarjeta: es un pago en efectivo con referencia.
 */
export async function createOxxoVoucher(opts: {
  reference: string;
  amount: number;
  description: string;
  payerEmail: string;
  payerFirstName?: string;
  payerLastName?: string;
  /** Horas de validez de la ficha (por defecto 72 h). */
  hoursValid?: number;
}): Promise<{ ok: true; voucher: OxxoVoucher } | { ok: false; error: string }> {
  const stored = await loadMpCreds();
  const token = pick(stored, "MERCADOPAGO_ACCESS_TOKEN");
  if (!token) return { ok: false, error: "Mercado Pago no está configurado todavía." };

  const existing = await findExistingOxxo(token, opts.reference);
  if (existing) return { ok: true, voucher: existing };

  const expires = new Date(Date.now() + (opts.hoursValid ?? 72) * 3600 * 1000);
  const body = {
    transaction_amount: Math.round(opts.amount * 100) / 100,
    description: opts.description,
    payment_method_id: "oxxo",
    external_reference: opts.reference,
    date_of_expiration: expires.toISOString().replace("Z", "+00:00"),
    notification_url: `${process.env['PUBLIC_URL'] || "https://lajanrapid.app"}/api/public/mercadopago/webhook`,
    payer: {
      email: opts.payerEmail,
      first_name: opts.payerFirstName ?? "Cliente",
      last_name: opts.payerLastName ?? "Lajan",
    },
  };

  try {
    const res = await fetch(`${MP_API}/v1/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `oxxo-${opts.reference}`,
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      console.error("Mercado Pago OXXO: error al crear la ficha", res.status, json["message"]);
      return { ok: false, error: "No pudimos generar la ficha OXXO. Intenta de nuevo." };
    }
    return { ok: true, voucher: mapOxxo(json) };
  } catch (e) {
    console.error("Mercado Pago OXXO: error de red", e);
    return { ok: false, error: "No pudimos contactar a Mercado Pago." };
  }
}

/* ------------------------------------------------------------------ *
 * SPEI — transferencia bancaria con CLABE real (Mercado Pago México)
 * ------------------------------------------------------------------ */

export type SpeiReference = {
  paymentId: string;
  /** CLABE interbancaria a la que el cliente transfiere. */
  clabe: string;
  /** Banco receptor informado por Mercado Pago. */
  bank: string | null;
  /** Concepto/referencia que debe capturar en su banca en línea. */
  concept: string;
  /** Comprobante imprimible (si el emisor lo entrega). */
  voucherUrl: string | null;
  expiresAt: string | null;
  amount: number;
  currency: string;
  status: string;
};

function mapSpei(p: Record<string, unknown>, concept: string): SpeiReference {
  const td = (p["transaction_details"] ?? {}) as Record<string, unknown>;
  const clabe =
    (typeof td["transaction_id"] === "string" && td["transaction_id"]) ||
    (typeof td["payment_method_reference_id"] === "string" && td["payment_method_reference_id"]) ||
    (typeof td["verification_code"] === "string" && td["verification_code"]) ||
    "";
  return {
    paymentId: String(p["id"]),
    clabe: String(clabe),
    bank:
      typeof td["financial_institution"] === "string"
        ? (td["financial_institution"] as string)
        : null,
    concept,
    voucherUrl:
      typeof td["external_resource_url"] === "string"
        ? (td["external_resource_url"] as string)
        : null,
    expiresAt: typeof p["date_of_expiration"] === "string" ? (p["date_of_expiration"] as string) : null,
    amount: Number(p["transaction_amount"] ?? 0),
    currency: String(p["currency_id"] ?? "MXN"),
    status: String(p["status"] ?? "pending"),
  };
}

async function findExistingSpei(
  token: string,
  reference: string,
): Promise<SpeiReference | null> {
  const url = `${MP_API}/v1/payments/search?external_reference=${encodeURIComponent(reference)}&sort=date_created&criteria=desc&limit=10`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const json = (await res.json()) as { results?: Record<string, unknown>[] };
  for (const p of json.results ?? []) {
    if (p["payment_method_id"] !== "clabe") continue;
    if (p["status"] !== "pending") continue;
    const s = mapSpei(p, reference);
    if (!s.clabe) continue;
    if (s.expiresAt && new Date(s.expiresAt).getTime() < Date.now()) continue;
    return s;
  }
  return null;
}

/** Crea (o reutiliza) una CLABE real de pago SPEI para un envío. */
export async function createSpeiReference(opts: {
  reference: string;
  amount: number;
  description: string;
  payerEmail: string;
  payerFirstName?: string;
  payerLastName?: string;
  hoursValid?: number;
}): Promise<{ ok: true; spei: SpeiReference } | { ok: false; error: string }> {
  const stored = await loadMpCreds();
  const token = pick(stored, "MERCADOPAGO_ACCESS_TOKEN");
  if (!token) return { ok: false, error: "Mercado Pago no está configurado todavía." };

  const existing = await findExistingSpei(token, opts.reference);
  if (existing) return { ok: true, spei: existing };

  const expires = new Date(Date.now() + (opts.hoursValid ?? 72) * 3600 * 1000);
  const body = {
    transaction_amount: Math.round(opts.amount * 100) / 100,
    description: opts.description,
    payment_method_id: "clabe",
    external_reference: opts.reference,
    date_of_expiration: expires.toISOString().replace("Z", "+00:00"),
    notification_url: `${process.env['PUBLIC_URL'] || "https://lajanrapid.app"}/api/public/mercadopago/webhook`,
    payer: {
      email: opts.payerEmail,
      first_name: opts.payerFirstName ?? "Cliente",
      last_name: opts.payerLastName ?? "Lajan",
    },
  };

  try {
    const res = await fetch(`${MP_API}/v1/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `spei-${opts.reference}`,
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      console.error("Mercado Pago SPEI: error al crear la CLABE", res.status, json["message"]);
      return { ok: false, error: "No pudimos generar la CLABE SPEI. Intenta de nuevo." };
    }
    const spei = mapSpei(json, opts.reference);
    if (!spei.clabe) {
      return { ok: false, error: "Mercado Pago no devolvió una CLABE para este pago." };
    }
    return { ok: true, spei };
  } catch (e) {
    console.error("Mercado Pago SPEI: error de red", e);
    return { ok: false, error: "No pudimos contactar a Mercado Pago." };
  }
}
