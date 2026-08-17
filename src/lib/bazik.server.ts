// Conector Bazik (bazik.io) — capa de acceso al proveedor.
// Dos APIs separadas, cada una con su propia credencial:
//  1) COBROS  (collections) → los clientes recargan su billetera.
//  2) ENVÍOS  (payouts)     → enviar dinero a MonCash / NatCash.

export type BazikWallet = "moncash" | "natcash";

export type BazikTopupInput = {
  walletId: string;
  amount: number;
  currency: string;
  reference: string;
};

export type BazikPayoutInput = {
  provider: BazikWallet;
  phone: string;
  amount: number;
  currency: string;
  reference: string;
};

export type BazikResult = {
  ok: boolean;
  configured: boolean;
  providerReference?: string;
  status?: string;
  error?: string;
};

type Creds = { baseUrl: string; apiKey?: string; apiSecret?: string };

export const BAZIK_CRED_NAMES = [
  "BAZIK_BASE_URL",
  "BAZIK_USER_ID",
  "BAZIK_SECRET_KEY",
  "BAZIK_WEBHOOK_SECRET",
  "BAZIK_COLLECT_API_KEY",
  "BAZIK_COLLECT_API_SECRET",
  "BAZIK_PAYOUT_API_KEY",
  "BAZIK_PAYOUT_API_SECRET",
] as const;

export type BazikCredName = (typeof BAZIK_CRED_NAMES)[number];

/** Lee las credenciales guardadas manualmente desde el panel de administración. */
export async function loadStoredCreds(): Promise<Record<string, string>> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("integration_credentials")
      .select("name, value")
      .in("name", [...BAZIK_CRED_NAMES]);
    const out: Record<string, string> = {};
    for (const row of data ?? []) if (row.value) out[row.name] = row.value;
    return out;
  } catch (e) {
    console.error("No se pudieron leer las credenciales guardadas", e);
    return {};
  }
}

/** Guarda (o borra si el valor viene vacío) una credencial. */
export async function saveStoredCred(name: string, value: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!value) {
    await supabaseAdmin.from("integration_credentials").delete().eq("name", name);
    return;
  }
  await supabaseAdmin
    .from("integration_credentials")
    .upsert({ name, value, updated_at: new Date().toISOString(), updated_by: userId });
}

function pick(stored: Record<string, string>, ...names: string[]) {
  for (const n of names) {
    const v = process.env[n] ?? stored[n];
    if (v) return v;
  }
  return undefined;
}

function baseUrlFrom(stored: Record<string, string>) {
  return (pick(stored, "BAZIK_BASE_URL") ?? "https://api.bazik.io").replace(/\/$/, "");
}

function credsFor(stored: Record<string, string>, kind: "COLLECT" | "PAYOUT"): Creds {
  // Bazik entrega una sola cuenta (User ID + Secret Key); si no hay credenciales
  // separadas por API, se usa la cuenta global.
  const key = pick(stored, `BAZIK_${kind}_API_KEY`, "BAZIK_API_KEY", "BAZIK_USER_ID");
  const secret = pick(
    stored,
    `BAZIK_${kind}_API_SECRET`,
    "BAZIK_API_SECRET",
    "BAZIK_SECRET_KEY",
  );
  return {
    baseUrl: baseUrlFrom(stored),
    ...(key ? { apiKey: key } : {}),
    ...(secret ? { apiSecret: secret } : {}),
  };
}

/** Secreto de firma de los webhooks de Bazik (env o guardado en el panel). */
export async function bazikWebhookSecret(): Promise<string | undefined> {
  const stored = await loadStoredCreds();
  return pick(stored, "BAZIK_WEBHOOK_SECRET");
}

/** Estado de ambas conexiones Bazik para el panel de administración. */
export async function bazikStatusInfo() {
  const stored = await loadStoredCreds();
  const url = baseUrlFrom(stored);
  const collect = credsFor(stored, "COLLECT");
  const payout = credsFor(stored, "PAYOUT");
  return {
    baseUrl: url,
    configured: Boolean(collect.apiKey && payout.apiKey),
    topupEndpoint: `${url}/v1/collections`,
    payoutEndpoint: `${url}/v1/payouts`,
    collect: {
      label: "API de cobros (recargar billetera)",
      endpoint: `${url}/v1/collections`,
      keyName: "BAZIK_COLLECT_API_KEY",
      secretName: "BAZIK_COLLECT_API_SECRET",
      hasKey: Boolean(collect.apiKey),
      hasSecret: Boolean(collect.apiSecret),
    },
    payout: {
      label: "API de envíos (MonCash / NatCash)",
      endpoint: `${url}/v1/payouts`,
      keyName: "BAZIK_PAYOUT_API_KEY",
      secretName: "BAZIK_PAYOUT_API_SECRET",
      hasKey: Boolean(payout.apiKey),
      hasSecret: Boolean(payout.apiSecret),
    },
  };
}


async function callBazik(creds: Creds, path: string, body: unknown): Promise<BazikResult> {
  if (!creds.apiKey) {
    return { ok: false, configured: false, error: `Falta la credencial de Bazik para ${path}` };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    // Con cuenta Bazik (User ID + Secret Key) el bearer es la Secret Key.
    Authorization: `Bearer ${creds.apiSecret ?? creds.apiKey}`,
    "X-Api-Key": creds.apiKey,
    "X-User-Id": creds.apiKey,
  };
  if (creds.apiSecret) headers["X-Api-Secret"] = creds.apiSecret;

  const response = await fetch(`${creds.baseUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    /* respuesta no JSON */
  }

  if (!response.ok) {
    console.error(`Bazik ${path} falló [${response.status}]: ${text}`);
    return { ok: false, configured: true, error: `Bazik [${response.status}]: ${text}` };
  }

  const data = parsed as { id?: string; reference?: string; status?: string };
  return {
    ok: true,
    configured: true,
    ...(data.id || data.reference ? { providerReference: data.id ?? data.reference! } : {}),
    ...(data.status ? { status: data.status } : {}),
  };
}

/** API #1 — cobro: recargar la billetera del cliente vía Bazik. */
export async function bazikTopup(input: BazikTopupInput) {
  const stored = await loadStoredCreds();
  return callBazik(credsFor(stored, "COLLECT"), "/v1/collections", {
    amount: input.amount,
    currency: input.currency,
    reference: input.reference,
    metadata: { wallet_id: input.walletId },
  });
}

/** API #2 — envío: mandar dinero a MonCash o NatCash vía Bazik. */
export async function bazikPayout(input: BazikPayoutInput) {
  const stored = await loadStoredCreds();
  return callBazik(credsFor(stored, "PAYOUT"), "/v1/payouts", {
    provider: input.provider,
    destination: input.phone,
    amount: input.amount,
    currency: input.currency,
    reference: input.reference,
  });
}

