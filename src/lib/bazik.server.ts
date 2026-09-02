// Conector Bazik (bazik.io) — API oficial de pagos MonCash para Haití.
//
// Spec oficial confirmado:
//   base_url: https://api.bazik.io
//   auth: Bearer Token (JWT), obtenido vía POST /token con { userID, secretKey }
//   respuesta confirmada de /token: { access_token, token_type: "bearer",
//     expires_in (segundos, ej. 86400 = 24h), user_id }
//   content_type: application/json
//   supported_currencies: ["HTG"]
//   max_transaction_amount: 75000 HTG
//   rate_limiting: 100 requests/minute
//   supported_payment_methods: ["MonCash"]  ⚠️ NatCash NO está confirmado en el spec oficial
//   environment_types: ["sandbox", "production"]
//   webhook_support: true
//
// TODO: falta el spec de los endpoints de payout/transfer/quote (ruta, método, body,
// forma de la respuesta). Este archivo implementa la autenticación real; las funciones
// de payout/quote quedan pendientes hasta tener esa documentación.

export const BAZIK_MAX_TRANSACTION_HTG = 75000;

export const BAZIK_CRED_NAMES = [
  "BAZIK_BASE_URL",
  "BAZIK_USER_ID",
  "BAZIK_SECRET_KEY",
  "BAZIK_WEBHOOK_SECRET",
  "BAZIK_ENVIRONMENT",
] as const;

export type BazikCredName = (typeof BAZIK_CRED_NAMES)[number];

type Creds = {
  baseUrl: string;
  userId?: string;
  secretKey?: string;
  environment: "sandbox" | "production";
};

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
    console.error("No se pudieron leer las credenciales guardadas de Bazik", e);
    return {};
  }
}

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

function pick(stored: Record<string, string>, name: BazikCredName) {
  return process.env[name] ?? stored[name];
}

function credsFor(stored: Record<string, string>): Creds {
  const baseUrl = (pick(stored, "BAZIK_BASE_URL") ?? "https://api.bazik.io").replace(/\/$/, "");
  const envRaw = (pick(stored, "BAZIK_ENVIRONMENT") ?? "production").toLowerCase();
  const environment: Creds["environment"] = envRaw === "sandbox" ? "sandbox" : "production";
  const userId = pick(stored, "BAZIK_USER_ID");
  const secretKey = pick(stored, "BAZIK_SECRET_KEY");
  return {
    baseUrl,
    environment,
    ...(userId ? { userId } : {}),
    ...(secretKey ? { secretKey } : {}),
  };
}

export async function bazikWebhookSecret(): Promise<string | undefined> {
  const stored = await loadStoredCreds();
  return pick(stored, "BAZIK_WEBHOOK_SECRET");
}

// --- Autenticación --------------------------------------------------------

export type BazikAuthResult =
  { ok: true; token: string; expiresAt?: number } | { ok: false; error: string };

// El JWT se cachea en memoria del proceso (no persiste entre despliegues/cold starts,
// lo cual es aceptable dado que un nuevo token se pide automáticamente si falta o expiró).
let cachedToken: { token: string; expiresAt: number; userId: string } | null = null;

// Forma real confirmada de la respuesta de POST /token:
// { access_token, token_type: "bearer", expires_in (segundos), user_id }
function extractToken(payload: unknown): { token: string | null; expiresAt: number | null } {
  const data = (payload ?? {}) as Record<string, unknown>;
  const token =
    (data["access_token"] as string | undefined) ??
    (data["accessToken"] as string | undefined) ??
    (data["token"] as string | undefined) ??
    (data["jwt"] as string | undefined) ??
    null;

  const expiresIn =
    (data["expires_in"] as number | undefined) ?? (data["expiresIn"] as number | undefined) ?? null;
  const expiresAt = typeof expiresIn === "number" ? Date.now() + expiresIn * 1000 : null;

  return { token, expiresAt };
}

/** Obtiene (o reutiliza) el JWT de Bazik autenticando con userID + secretKey. */
export async function bazikAuthenticate(forceRefresh = false): Promise<BazikAuthResult> {
  const stored = await loadStoredCreds();
  const creds = credsFor(stored);

  if (!creds.userId || !creds.secretKey) {
    return {
      ok: false,
      error:
        "Falta la conexión de Bazik: necesita User ID + Secret Key en el panel de administración.",
    };
  }

  if (
    !forceRefresh &&
    cachedToken &&
    cachedToken.userId === creds.userId &&
    cachedToken.expiresAt > Date.now() + 5_000
  ) {
    return { ok: true, token: cachedToken.token, expiresAt: cachedToken.expiresAt };
  }

  try {
    const response = await fetch(`${creds.baseUrl}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userID: creds.userId, secretKey: creds.secretKey }),
    });

    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      // respuesta no-JSON
    }

    if (!response.ok) {
      console.error(`Bazik /token falló [${response.status}]: ${text}`);
      return { ok: false, error: `Bazik rechazó la autenticación (HTTP ${response.status}).` };
    }

    const { token, expiresAt } = extractToken(parsed);
    if (!token) {
      console.error("Bazik /token: respuesta sin token reconocible", parsed);
      return { ok: false, error: "Bazik no devolvió un token reconocible." };
    }

    const finalExpiresAt = expiresAt ?? Date.now() + 55 * 60 * 1000; // fallback ~55min
    cachedToken = { token, expiresAt: finalExpiresAt, userId: creds.userId };

    return { ok: true, token, expiresAt: finalExpiresAt };
  } catch (error) {
    console.error("Bazik /token lanzó error:", error);
    return { ok: false, error: "No se pudo contactar a Bazik para autenticar." };
  }
}

// --- Estado de configuración (para el panel de admin) ---------------------

export async function bazikStatusInfo() {
  const stored = await loadStoredCreds();
  const creds = credsFor(stored);
  const auth = await bazikAuthenticate();

  return {
    baseUrl: creds.baseUrl,
    environment: creds.environment,
    configured: Boolean(creds.userId && creds.secretKey),
    hasUserId: Boolean(creds.userId),
    hasSecretKey: Boolean(creds.secretKey),
    hasWebhookSecret: Boolean(pick(stored, "BAZIK_WEBHOOK_SECRET")),
    authOk: auth.ok,
    authError: auth.ok ? undefined : auth.error,
  };
}

// --- Payout / Transfer / Quote --------------------------------------------
// TODO: pendientes de implementar hasta contar con el spec de estos endpoints
// (ruta exacta, método, body esperado y forma de la respuesta de Bazik).
// La autenticación de arriba (bazikAuthenticate) ya está lista para usarse
// en el header `Authorization: Bearer <token>` una vez se agreguen estas funciones.
