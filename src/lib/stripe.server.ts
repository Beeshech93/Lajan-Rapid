// Conector Stripe — verificación de webhooks y sincronización de pagos.
// Credenciales guardadas manualmente desde el panel de administración
// (o por variables de entorno del mismo nombre).

export const STRIPE_CRED_NAMES = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] as const;

export type StripeCredName = (typeof STRIPE_CRED_NAMES)[number];

const STRIPE_API = "https://api.stripe.com/v1";

export async function loadStripeCreds(): Promise<Record<string, string>> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("integration_credentials")
      .select("name, value")
      .in("name", [...STRIPE_CRED_NAMES]);
    const out: Record<string, string> = {};
    for (const row of data ?? []) if (row.value) out[row.name] = row.value;
    return out;
  } catch (e) {
    console.error("No se pudieron leer las credenciales de Stripe", e);
    return {};
  }
}

export async function saveStripeCred(name: string, value: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!value) {
    await supabaseAdmin.from("integration_credentials").delete().eq("name", name);
    return;
  }
  await supabaseAdmin
    .from("integration_credentials")
    .upsert({ name, value, updated_at: new Date().toISOString(), updated_by: userId });
}

function pick(stored: Record<string, string>, name: StripeCredName) {
  return process.env[name] ?? stored[name];
}

export async function stripeStatusInfo() {
  const stored = await loadStripeCreds();
  return {
    hasSecretKey: Boolean(pick(stored, "STRIPE_SECRET_KEY")),
    hasWebhookSecret: Boolean(pick(stored, "STRIPE_WEBHOOK_SECRET")),
    mode: (pick(stored, "STRIPE_SECRET_KEY") ?? "").startsWith("sk_live") ? "live" : "test",
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
 * Verifica la cabecera `Stripe-Signature` (esquema oficial `t=...,v1=...`,
 * HMAC-SHA256 de `${t}.${rawBody}` con el secreto `whsec_...`).
 */
export async function verifyStripeSignature(opts: {
  signatureHeader: string | null;
  rawBody: string;
  toleranceSeconds?: number;
}): Promise<{ ok: boolean; reason?: string }> {
  const stored = await loadStripeCreds();
  const secret = pick(stored, "STRIPE_WEBHOOK_SECRET");
  if (!secret) return { ok: false, reason: "Falta STRIPE_WEBHOOK_SECRET" };
  if (!opts.signatureHeader) return { ok: false, reason: "Falta la cabecera Stripe-Signature" };

  let ts: string | undefined;
  const signatures: string[] = [];
  for (const part of opts.signatureHeader.split(",")) {
    const [k, ...rest] = part.split("=");
    const key = (k ?? "").trim();
    const value = rest.join("=").trim();
    if (key === "t") ts = value;
    if (key === "v1") signatures.push(value.toLowerCase());
  }
  if (!ts || signatures.length === 0) return { ok: false, reason: "Firma malformada" };

  const tolerance = (opts.toleranceSeconds ?? 300) * 1000;
  const tsMs = Number(ts) * 1000;
  if (Number.isFinite(tsMs) && Math.abs(Date.now() - tsMs) > tolerance) {
    return { ok: false, reason: "Firma expirada" };
  }

  const expected = await hmacSha256Hex(secret, `${ts}.${opts.rawBody}`);
  return signatures.some((s) => timingSafeEqualHex(expected, s))
    ? { ok: true }
    : { ok: false, reason: "Firma inválida" };
}

/** Crea una sesión real de Stripe Checkout (modo pago único, solo tarjeta) y retorna su URL. */
export async function createStripeCheckoutSession(opts: {
  transferId: string;
  reference: string;
  amount: number;
  currency: string;
  description: string;
  buyerEmail?: string;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<{ ok: true; checkoutUrl: string } | { ok: false; error: string }> {
  const stored = await loadStripeCreds();
  const key = pick(stored, "STRIPE_SECRET_KEY");
  if (!key) {
    return {
      ok: false,
      error:
        "Falta la conexión de Stripe: necesita STRIPE_SECRET_KEY en el panel de administración.",
    };
  }

  const base = process.env["PUBLIC_URL"] || "https://lajanrapid.app";
  const successUrl = opts.successUrl ?? `${base}/transferencia/${opts.transferId}?payment=success`;
  const cancelUrl = opts.cancelUrl ?? `${base}/transferencia/${opts.transferId}?payment=failure`;

  // Stripe espera montos en la unidad mínima de la moneda (centavos para monedas
  // de 2 decimales como MXN/USD/EUR).
  const unitAmount = Math.round(opts.amount * 100);

  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("client_reference_id", opts.reference);
  body.set("success_url", successUrl);
  body.set("cancel_url", cancelUrl);
  body.set("payment_method_types[0]", "card");
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", opts.currency.toLowerCase());
  body.set("line_items[0][price_data][unit_amount]", String(unitAmount));
  body.set("line_items[0][price_data][product_data][name]", opts.description);
  body.set("metadata[reference]", opts.reference);
  if (opts.buyerEmail) body.set("customer_email", opts.buyerEmail);

  try {
    const response = await fetch(`${STRIPE_API}/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const text = await response.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      // respuesta no-JSON
    }

    if (!response.ok) {
      const message =
        ((parsed["error"] as Record<string, unknown> | undefined)?.["message"] as
          string | undefined) ?? text.slice(0, 200);
      console.error(`Stripe checkout/sessions falló [${response.status}]: ${text}`);
      return { ok: false, error: `Stripe rechazó el pago: ${message}` };
    }

    const checkoutUrl = parsed["url"] as string | undefined;
    if (!checkoutUrl) return { ok: false, error: "Stripe no devolvió una URL de pago." };

    return { ok: true, checkoutUrl };
  } catch (error) {
    console.error("Stripe checkout/sessions lanzó error:", error);
    return { ok: false, error: "No se pudo contactar a Stripe para iniciar el pago." };
  }
}

export type StripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

/** Reconsulta el evento en la API de Stripe (nunca se confía solo en el cuerpo). */
export async function fetchStripeEvent(eventId: string): Promise<StripeEvent | null> {
  const stored = await loadStripeCreds();
  const key = pick(stored, "STRIPE_SECRET_KEY");
  if (!key) {
    console.error("Stripe: falta STRIPE_SECRET_KEY");
    return null;
  }
  const res = await fetch(`${STRIPE_API}/events/${encodeURIComponent(eventId)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    console.error(`Stripe: consulta del evento ${eventId} falló [${res.status}]`);
    return null;
  }
  return (await res.json()) as StripeEvent;
}

type TransferStatus = "paid" | "awaiting_payment" | "cancelled";

/** Traduce el tipo de evento de Stripe al estado del envío. */
export function mapStripeEvent(type: string): TransferStatus | null {
  switch (type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "payment_intent.succeeded":
    case "charge.succeeded":
      return "paid";
    case "payment_intent.processing":
    case "checkout.session.async_payment_pending":
    case "payment_intent.created":
      return "awaiting_payment";
    case "payment_intent.payment_failed":
    case "payment_intent.canceled":
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed":
    case "charge.refunded":
    case "charge.dispute.created":
      return "cancelled";
    default:
      return null;
  }
}

/** Extrae la referencia del envío (RH-XXXXXXXX) del objeto del evento. */
export function extractReference(obj: Record<string, unknown>): string | null {
  const metadata = obj["metadata"] as Record<string, unknown> | undefined;
  const paymentIntent = obj["payment_intent"] as { metadata?: Record<string, unknown> } | undefined;
  const candidates = [
    obj["client_reference_id"],
    metadata?.["reference"],
    metadata?.["transfer_reference"],
    paymentIntent?.metadata?.["reference"],
    obj["description"],
  ];
  for (const c of candidates) {
    if (typeof c !== "string") continue;
    const match = c.match(/RH-[A-Z0-9]{6,}/i);
    if (match) return match[0].toUpperCase();
    if (c.trim()) return c.trim();
  }
  return null;
}

const STATUS_TEXT: Record<TransferStatus, { title: string; body: string }> = {
  paid: { title: "Pago confirmado", body: "Recibimos tu pago y ya estamos procesando el envío." },
  awaiting_payment: { title: "Pago pendiente", body: "Tu pago está en proceso de confirmación." },
  cancelled: { title: "Pago no completado", body: "El pago fue rechazado, cancelado o devuelto." },
};

/** Aplica el resultado del evento de Stripe al envío correspondiente. */
export async function applyStripeEvent(event: StripeEvent) {
  const next = mapStripeEvent(event.type);
  if (!next) return { ok: true, ignored: `Evento no manejado: ${event.type}` };

  const ref = extractReference(event.data?.object ?? {});
  if (!ref) return { ok: false, reason: "El evento no trae la referencia del envío" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: transfer } = await supabaseAdmin
    .from("transfers")
    .select("id, user_id, status, reference")
    .eq("reference", ref)
    .maybeSingle();

  if (!transfer) return { ok: false, reason: `No existe el envío ${ref}` };
  if (transfer.status === next) return { ok: true, unchanged: true, transferId: transfer.id };
  if (["completed", "processing"].includes(transfer.status)) {
    return { ok: true, unchanged: true, transferId: transfer.id };
  }

  const { error } = await supabaseAdmin
    .from("transfers")
    .update({ status: next })
    .eq("id", transfer.id);
  if (error) {
    console.error("Stripe: no se pudo actualizar el envío", error);
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
