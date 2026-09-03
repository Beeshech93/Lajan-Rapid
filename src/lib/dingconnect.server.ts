// Conector DingConnect — recargas de saldo móvil (top-up) internacionales.
// Credenciales guardadas manualmente desde el panel de administración
// (o por variables de entorno del mismo nombre).

export const DING_CRED_NAMES = [
  "DINGCONNECT_BASE_URL",
  "DINGCONNECT_API_KEY",
  "DINGCONNECT_WEBHOOK_SECRET",
] as const;

export type DingCredName = (typeof DING_CRED_NAMES)[number];

const DEFAULT_BASE_URL = "https://api.dingconnect.com/api/V1";

export async function loadDingCreds(): Promise<Record<string, string>> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("integration_credentials")
      .select("name, value")
      .in("name", [...DING_CRED_NAMES]);
    const out: Record<string, string> = {};
    for (const row of data ?? []) if (row.value) out[row.name] = row.value;
    return out;
  } catch (e) {
    console.error("No se pudieron leer las credenciales de DingConnect", e);
    return {};
  }
}

export async function saveDingCred(name: string, value: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!value) {
    await supabaseAdmin.from("integration_credentials").delete().eq("name", name);
    return;
  }
  await supabaseAdmin
    .from("integration_credentials")
    .upsert({ name, value, updated_at: new Date().toISOString(), updated_by: userId });
}

function pick(stored: Record<string, string>, name: DingCredName) {
  return process.env[name] ?? stored[name];
}

export async function dingStatusInfo() {
  const stored = await loadDingCreds();
  return {
    baseUrl: pick(stored, "DINGCONNECT_BASE_URL") ?? DEFAULT_BASE_URL,
    hasApiKey: Boolean(pick(stored, "DINGCONNECT_API_KEY")),
    hasWebhookSecret: Boolean(pick(stored, "DINGCONNECT_WEBHOOK_SECRET")),
  };
}

async function dingFetch(path: string, init?: RequestInit) {
  const stored = await loadDingCreds();
  const apiKey = pick(stored, "DINGCONNECT_API_KEY");
  const baseUrl = (pick(stored, "DINGCONNECT_BASE_URL") ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  if (!apiKey)
    throw new Error("Falta DINGCONNECT_API_KEY: configúralo en Administración → DingConnect");

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      api_key: apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`DingConnect ${path} falló [${res.status}]: ${text}`);
    throw new Error(`DingConnect [${res.status}]: ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {} as unknown;
  }
}

export type DingProduct = {
  skuCode: string;
  operator: string;
  countryCode: string;
  minValue: number | null;
  maxValue: number | null;
  currency: string;
};

/** Catálogo de productos (operadores y montos) por país. */
export async function dingProducts(countryCode: string): Promise<DingProduct[]> {
  type DingProductItem = {
    SkuCode?: unknown;
    ProviderCode?: unknown;
    ProviderName?: unknown;
    CountryIso?: unknown;
    Minimum?: { SendValue?: number; SendCurrencyIso?: string };
    Maximum?: { SendValue?: number };
  };
  const raw = (await dingFetch(
    `/GetProducts?countryIsos=${encodeURIComponent(countryCode.toUpperCase())}`,
  )) as { Items?: DingProductItem[] };
  return (raw.Items ?? []).slice(0, 200).map((p) => ({
    skuCode: String(p["SkuCode"] ?? ""),
    operator: String(p["ProviderCode"] ?? p["ProviderName"] ?? ""),
    countryCode: String(p["CountryIso"] ?? countryCode).toUpperCase(),
    minValue: p["Minimum"]?.["SendValue"] ?? null,
    maxValue: p["Maximum"]?.["SendValue"] ?? null,
    currency: String(p["Minimum"]?.["SendCurrencyIso"] ?? ""),
  }));
}

/** Envía la recarga al proveedor. La confirmación final llega por webhook. */
export async function dingSendTransfer(opts: {
  skuCode: string;
  sendValue: number;
  sendCurrency: string;
  accountNumber: string;
  distributorRef: string;
}) {
  const raw = (await dingFetch("/SendTransfer", {
    method: "POST",
    body: JSON.stringify({
      SkuCode: opts.skuCode,
      SendValue: opts.sendValue,
      SendCurrencyIso: opts.sendCurrency,
      AccountNumber: opts.accountNumber,
      DistributorRef: opts.distributorRef,
      ValidateOnly: false,
    }),
  })) as { TransferRecord?: { TransferId?: string | number; ProcessingState?: string } };
  return {
    providerRef: raw.TransferRecord?.TransferId ? String(raw.TransferRecord.TransferId) : null,
    processingState: raw.TransferRecord?.ProcessingState ?? "Processing",
  };
}

function timingSafeEqual(a: string, b: string) {
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
 * Verifica la notificación de DingConnect.
 * Acepta firma HMAC-SHA256 del cuerpo (`x-signature`) o el secreto compartido
 * enviado en `x-webhook-secret` / `?secret=`.
 */
export async function verifyDingWebhook(opts: {
  signatureHeader: string | null;
  sharedSecretHeader: string | null;
  rawBody: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const stored = await loadDingCreds();
  const secret = pick(stored, "DINGCONNECT_WEBHOOK_SECRET");
  if (!secret) return { ok: false, reason: "Falta DINGCONNECT_WEBHOOK_SECRET" };

  if (opts.sharedSecretHeader && timingSafeEqual(opts.sharedSecretHeader.trim(), secret)) {
    return { ok: true };
  }
  if (opts.signatureHeader) {
    const provided = opts.signatureHeader
      .replace(/^sha256=/i, "")
      .trim()
      .toLowerCase();
    const expected = await hmacSha256Hex(secret, opts.rawBody);
    if (timingSafeEqual(expected, provided)) return { ok: true };
  }
  return { ok: false, reason: "Firma o secreto inválido" };
}

type TopupStatus = "processing" | "completed" | "failed";

export function mapDingState(state: string): TopupStatus | null {
  switch (state.toLowerCase()) {
    case "completed":
    case "success":
    case "succeeded":
      return "completed";
    case "processing":
    case "pending":
    case "inprogress":
      return "processing";
    case "failed":
    case "error":
    case "cancelled":
    case "canceled":
    case "refunded":
      return "failed";
    default:
      return null;
  }
}

const STATUS_TEXT: Record<TopupStatus, { title: string; body: string }> = {
  processing: {
    title: "Recarga en proceso",
    body: "Tu recarga está siendo procesada por el operador.",
  },
  completed: {
    title: "Recarga completada",
    body: "El saldo ya fue acreditado en el número indicado.",
  },
  failed: {
    title: "Recarga no completada",
    body: "El operador rechazó la recarga. Devolvimos el monto a tu billetera.",
  },
};

/** Aplica el resultado del proveedor a la recarga (y devuelve el saldo si falló). */
export async function applyDingResult(opts: {
  reference: string;
  state: string;
  providerRef?: string | null;
  detail?: string | null;
}) {
  const next = mapDingState(opts.state);
  if (!next) return { ok: false, reason: `Estado no manejado: ${opts.state}` };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: topup } = await supabaseAdmin
    .from("topups")
    .select("*")
    .eq("reference", opts.reference)
    .maybeSingle();

  if (!topup) return { ok: false, reason: `No existe la recarga ${opts.reference}` };
  if (topup.status === next) return { ok: true, unchanged: true, topupId: topup.id };
  if (["completed", "refunded"].includes(topup.status)) {
    return { ok: true, unchanged: true, topupId: topup.id };
  }

  const { error } = await supabaseAdmin
    .from("topups")
    .update({
      status: next,
      status_detail: opts.detail ?? null,
      ...(opts.providerRef ? { provider_ref: opts.providerRef } : {}),
    })
    .eq("id", topup.id);
  if (error) {
    console.error("DingConnect: no se pudo actualizar la recarga", error);
    return { ok: false, reason: error.message };
  }

  if (next === "failed" && !topup.refunded && topup.wallet_id) {
    const walletId = topup.wallet_id;
    const { data: wallet } = await supabaseAdmin
      .from("wallets")
      .select("balance")
      .eq("id", walletId)
      .maybeSingle();
    if (wallet) {
      await supabaseAdmin
        .from("wallets")
        .update({ balance: Number(wallet.balance) + Number(topup.amount) })
        .eq("id", walletId);
      await supabaseAdmin.from("wallet_transactions").insert({
        wallet_id: walletId,
        user_id: topup.user_id,
        kind: "topup_refund",
        amount: Number(topup.amount),
        currency: topup.currency,
        description: `Devolución de recarga ${topup.reference}`,
      });
      await supabaseAdmin.from("topups").update({ refunded: true }).eq("id", topup.id);
    }
  }

  const text = STATUS_TEXT[next];
  await supabaseAdmin.from("notifications").insert({
    user_id: topup.user_id,
    title: `${text.title} · ${topup.reference}`,
    body: text.body,
  });

  return { ok: true, topupId: topup.id, status: next };
}

/**
 * Se llama desde los webhooks de Stripe/Mercado Pago cuando se confirma (o falla)
 * el pago externo de una recarga con payment_method distinto de 'wallet'. Si el
 * pago fue aprobado, dispara el envío real a DingConnect; si falló, marca la
 * recarga como fallida (sin reembolso de billetera, ya que nunca se descontó de
 * ahí — el reembolso del pago externo debe gestionarse en Stripe/Mercado Pago).
 */
export async function applyExternalTopupPayment(reference: string, outcome: "paid" | "failed") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: topup } = await supabaseAdmin
    .from("topups")
    .select("*")
    .eq("reference", reference)
    .maybeSingle();

  if (!topup) return { ok: false, reason: `No existe la recarga ${reference}` };
  if (topup.status !== "pending") {
    return { ok: true, unchanged: true, topupId: topup.id };
  }

  if (outcome === "failed") {
    await supabaseAdmin
      .from("topups")
      .update({ status: "failed", status_detail: "Pago externo rechazado o cancelado" })
      .eq("id", topup.id);
    await supabaseAdmin.from("notifications").insert({
      user_id: topup.user_id,
      title: `Recarga no completada · ${topup.reference}`,
      body: "El pago no se pudo confirmar, la recarga fue cancelada.",
    });
    return { ok: true, topupId: topup.id, status: "failed" };
  }

  // Pago confirmado: marcar en proceso y disparar el envío real a DingConnect.
  await supabaseAdmin.from("topups").update({ status: "processing" }).eq("id", topup.id);

  try {
    const res = await dingSendTransfer({
      skuCode: topup.sku_code,
      sendValue: Number(topup.amount),
      sendCurrency: topup.currency,
      accountNumber: topup.phone,
      distributorRef: topup.reference,
    });
    return applyDingResult({
      reference: topup.reference,
      state: res.processingState,
      providerRef: res.providerRef,
    });
  } catch (e) {
    console.error("DingConnect: falló el envío tras pago externo confirmado", e);
    return applyDingResult({
      reference: topup.reference,
      state: "failed",
      detail: (e as Error).message,
    });
  }
}
