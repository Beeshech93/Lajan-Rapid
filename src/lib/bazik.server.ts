// Conector Bazik (bazik.io) — capa de acceso al proveedor REAL.
//
// Contrato verificado contra https://api.bazik.io :
//   POST /token                 { userID, secretKey } -> { token, expires_at }
//   GET  /wallet                -> { available, reserved, currency, environment }
//   POST /transfers/quote       { amount, provider } -> { delivery_amount, fee, total_cost }
//   POST /moncash/transfers     { gdes, wallet, description, referenceId }
//   POST /natcash/transfers     { gdes, wallet, description, referenceId, customerFirstName, customerLastName }
//   GET  /transfers/{id}        -> estado de la transferencia
//   GET  /balance, POST /moncash/withdraw  -> solo cuentas "online"/"instore"

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
  firstName?: string;
  lastName?: string;
  description?: string;
};

export type BazikResult = {
  ok: boolean;
  configured: boolean;
  providerReference?: string;
  status?: string;
  error?: string;
};

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
    for (const row of data ?? []) if (row.value) out[row.name] = String(row.value).trim();
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
    const v = process.env[n]?.trim() ?? stored[n];
    if (v) return v;
  }
  return undefined;
}

function baseUrlFrom(stored: Record<string, string>) {
  return (pick(stored, "BAZIK_BASE_URL") ?? "https://api.bazik.io").replace(/\/$/, "");
}

/** Secreto de firma de los webhooks de Bazik (env o guardado en el panel). */
export async function bazikWebhookSecret(): Promise<string | undefined> {
  const stored = await loadStoredCreds();
  return pick(stored, "BAZIK_WEBHOOK_SECRET");
}

type Session = { baseUrl: string; token: string };

let cached: { token: string; baseUrl: string; expiresAt: number } | null = null;

/** Autenticación real contra Bazik: POST /token con userID + secretKey. */
async function getSession(): Promise<{ session?: Session; error?: string }> {
  const stored = await loadStoredCreds();
  const baseUrl = baseUrlFrom(stored);
  const userID = pick(stored, "BAZIK_USER_ID", "BAZIK_PAYOUT_API_KEY", "BAZIK_COLLECT_API_KEY");
  const secretKey = pick(
    stored,
    "BAZIK_SECRET_KEY",
    "BAZIK_PAYOUT_API_SECRET",
    "BAZIK_COLLECT_API_SECRET",
  );
  if (!userID || !secretKey) {
    return { error: "Faltan las credenciales de Bazik (User ID y Secret Key)" };
  }

  if (cached && cached.baseUrl === baseUrl && cached.expiresAt > Date.now() + 30_000) {
    return { session: { baseUrl, token: cached.token } };
  }

  const res = await fetch(`${baseUrl}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userID, secretKey }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Bazik /token falló [${res.status}]`);
    return { error: `Bazik no aceptó las credenciales [${res.status}]` };
  }
  let token = "";
  let expiresAt = Date.now() + 10 * 60_000;
  try {
    const j = JSON.parse(text) as Record<string, unknown>;
    token = String(j["token"] ?? j["access_token"] ?? j["accessToken"] ?? "");
    const exp = j["expires_at"];
    if (typeof exp === "string" || typeof exp === "number") {
      const t = new Date(exp).getTime();
      if (!Number.isNaN(t)) expiresAt = t;
    }
  } catch {
    /* respuesta no JSON */
  }
  if (!token) return { error: "Bazik no devolvió un token válido" };
  cached = { token, baseUrl, expiresAt };
  return { session: { baseUrl, token } };
}

async function apiCall(
  session: Session,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<{ status: number; data: Record<string, unknown>; raw: string }> {
  const res = await fetch(`${session.baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${session.token}`,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const raw = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    /* respuesta no JSON */
  }
  return { status: res.status, data, raw };
}

function errorMessage(data: Record<string, unknown>, raw: string, status: number) {
  const msg = data["message"] ?? data["error"];
  return typeof msg === "string" ? msg : `Bazik [${status}]: ${raw.slice(0, 200)}`;
}

/** Saldo real de la cuenta Bazik. */
export async function bazikWallet() {
  const { session, error } = await getSession();
  if (!session) return { ok: false as const, error: error ?? "Sin sesión Bazik" };
  const { status, data, raw } = await apiCall(session, "GET", "/wallet");
  if (status !== 200) return { ok: false as const, error: errorMessage(data, raw, status) };
  return {
    ok: true as const,
    available: Number(data["available"] ?? 0),
    reserved: Number(data["reserved"] ?? 0),
    currency: String(data["currency"] ?? "HTG"),
    environment: String(data["environment"] ?? ""),
  };
}

/** Cotización real (monto entregado + comisión) para MonCash / NatCash. */
export async function bazikQuote(amount: number, provider: BazikWallet) {
  const { session, error } = await getSession();
  if (!session) return { ok: false as const, error: error ?? "Sin sesión Bazik" };
  const { status, data, raw } = await apiCall(session, "POST", "/transfers/quote", {
    amount,
    provider,
  });
  if (status !== 200) return { ok: false as const, error: errorMessage(data, raw, status) };
  return {
    ok: true as const,
    deliveryAmount: Number(data["delivery_amount"] ?? amount),
    fee: Number(data["fee"] ?? 0),
    totalCost: Number(data["total_cost"] ?? amount),
    currency: String(data["currency"] ?? "HTG"),
  };
}

/** Estado real de una transferencia Bazik. */
export async function bazikTransferStatus(transactionId: string) {
  const { session, error } = await getSession();
  if (!session) return { ok: false as const, error: error ?? "Sin sesión Bazik" };
  const { status, data, raw } = await apiCall(
    session,
    "GET",
    `/transfers/${encodeURIComponent(transactionId)}`,
  );
  if (status !== 200) return { ok: false as const, error: errorMessage(data, raw, status) };
  return { ok: true as const, data };
}

/** Estado de la conexión Bazik para el panel de administración. */
export async function bazikStatusInfo() {
  const stored = await loadStoredCreds();
  const url = baseUrlFrom(stored);
  const hasUserId = Boolean(pick(stored, "BAZIK_USER_ID"));
  const hasSecretKey = Boolean(pick(stored, "BAZIK_SECRET_KEY"));

  const wallet = hasUserId && hasSecretKey ? await bazikWallet() : null;

  return {
    baseUrl: url,
    account: {
      hasUserId,
      hasSecretKey,
      hasWebhookSecret: Boolean(pick(stored, "BAZIK_WEBHOOK_SECRET")),
    },
    connected: Boolean(wallet?.ok),
    connectionError: wallet && !wallet.ok ? wallet.error : undefined,
    balance: wallet?.ok
      ? {
          available: wallet.available,
          reserved: wallet.reserved,
          currency: wallet.currency,
          environment: wallet.environment,
        }
      : undefined,
    configured: Boolean(wallet?.ok),
    topupEndpoint: `${url}/transfers/quote`,
    payoutEndpoint: `${url}/moncash/transfers`,
    collect: {
      label: "API de cobros (recargar billetera)",
      endpoint: `${url}/moncash/payments/{referenceId}`,
      keyName: "BAZIK_COLLECT_API_KEY",
      secretName: "BAZIK_COLLECT_API_SECRET",
      hasKey: Boolean(pick(stored, "BAZIK_COLLECT_API_KEY")),
      hasSecret: Boolean(pick(stored, "BAZIK_COLLECT_API_SECRET")),
      available: false,
      note: "Tu cuenta Bazik es de tipo «transfer»: los cobros requieren una cuenta online/instore.",
    },
    payout: {
      label: "API de envíos (MonCash / NatCash)",
      endpoint: `${url}/moncash/transfers`,
      keyName: "BAZIK_PAYOUT_API_KEY",
      secretName: "BAZIK_PAYOUT_API_SECRET",
      hasKey: hasUserId,
      hasSecret: hasSecretKey,
      available: Boolean(wallet?.ok),
      note: "Mínimo NatCash: 3998 HTG. Comisión aproximada 5%.",
    },
  };
}

/** Normaliza el teléfono haitiano al formato que espera Bazik (509XXXXXXXX). */
function normalizeWallet(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("509")) return digits;
  return `509${digits.slice(-8)}`;
}

/** Cobro/recarga: la cuenta actual (tipo transfer) no está autorizada por Bazik. */
export async function bazikTopup(input: BazikTopupInput): Promise<BazikResult> {
  const { session, error } = await getSession();
  if (!session) return { ok: false, configured: false, error: error ?? "Sin sesión Bazik" };
  const { status, data, raw } = await apiCall(session, "GET", "/balance");
  if (status === 403) {
    return {
      ok: false,
      configured: true,
      error:
        "Tu cuenta Bazik es de tipo «transfer» y no puede recibir cobros. Solicita a Bazik una cuenta online/instore para habilitar las recargas.",
    };
  }
  if (status !== 200) {
    return { ok: false, configured: true, error: errorMessage(data, raw, status) };
  }
  return {
    ok: false,
    configured: true,
    error: `Recarga no disponible aún para la billetera ${input.walletId}`,
  };
}

/** Envío real de dinero a MonCash o NatCash. */
export async function bazikPayout(input: BazikPayoutInput): Promise<BazikResult> {
  const { session, error } = await getSession();
  if (!session) return { ok: false, configured: false, error: error ?? "Sin sesión Bazik" };

  const gdes = Math.round(input.amount * 100) / 100;
  const wallet = normalizeWallet(input.phone);
  const path = input.provider === "natcash" ? "/natcash/transfers" : "/moncash/transfers";

  const body: Record<string, unknown> = {
    gdes,
    amount: gdes,
    wallet,
    receiver: wallet,
    description: input.description ?? `Lajan Rapid ${input.reference}`,
    referenceId: input.reference,
    reference: input.reference,
  };
  if (input.provider === "natcash") {
    body["customerFirstName"] = input.firstName ?? "Lajan";
    body["customerLastName"] = input.lastName ?? "Rapid";
  }

  const { status, data, raw } = await apiCall(session, "POST", path, body);
  if (status < 200 || status >= 300) {
    console.error(`Bazik ${path} falló [${status}]: ${raw.slice(0, 300)}`);
    return { ok: false, configured: true, error: errorMessage(data, raw, status) };
  }

  const providerReference = String(
    data["transactionId"] ?? data["transaction_id"] ?? data["id"] ?? data["referenceId"] ?? "",
  );
  const st = data["status"];
  return {
    ok: true,
    configured: true,
    ...(providerReference ? { providerReference } : {}),
    ...(typeof st === "string" ? { status: st } : {}),
  };
}
