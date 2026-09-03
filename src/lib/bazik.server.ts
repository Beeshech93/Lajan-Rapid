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

// --- Payout MonCash (confirmado) -------------------------------------------
//
// Endpoint confirmado:
//   POST /moncash/withdraw
//   Headers: Authorization: Bearer <access_token>, Content-Type: application/json
//   Body: {
//     gdes: number,              // monto en gourdes (HTG)
//     wallet: string,            // número de MonCash del destinatario, sin código de país
//     description?: string,
//     referenceId: string,       // referencia única nuestra para el envío
//     customerFirstName: string,
//     customerLastName: string,
//     customerEmail?: string,
//     webhookUrl?: string,       // a donde Bazik notifica el resultado
//   }
//
// TODO: la forma exacta de la respuesta de éxito/error de /moncash/withdraw aún no
// está confirmada. bazikPayout() maneja esto de forma defensiva (intenta varios
// nombres de campo comunes); ajustar normaliseBazikResult() en cuanto se confirme.

export type BazikPayoutInput = {
  provider: "moncash" | "natcash";
  phone: string;
  amount: number;
  currency: string;
  reference: string;
  recipientName: string;
  recipientEmail?: string;
};

export type BazikResult =
  | {
      ok: true;
      status?: string;
      providerReference?: string;
      raw?: unknown;
    }
  | { ok: false; configured?: boolean; error: string };

function normalisePhoneToMonCashWallet(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // El ejemplo confirmado usa 8 dígitos sin código de país (509).
  return digits.length > 8 ? digits.slice(-8) : digits;
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  const idx = trimmed.indexOf(" ");
  if (idx === -1) return { firstName: trimmed || "Cliente", lastName: "Lajan Rapid" };
  return { firstName: trimmed.slice(0, idx), lastName: trimmed.slice(idx + 1) };
}

function bazikWebhookUrl(): string {
  const base = process.env["PUBLIC_URL"] || "https://lajanrapid.app";
  return `${base}/api/public/bazik/payout`;
}

// Intenta reconocer el estado/referencia en la respuesta de /moncash/withdraw,
// cuya forma exacta aún no está confirmada.
export function normaliseBazikResult(payload: unknown): {
  providerReference?: string;
  status?: string;
} {
  const data = (payload ?? {}) as Record<string, unknown>;
  const nested = (data["data"] as Record<string, unknown> | undefined) ?? undefined;
  const withdrawal = (data["withdrawal"] as Record<string, unknown> | undefined) ?? undefined;

  const providerReference =
    (data["id"] as string | undefined) ??
    (data["transactionId"] as string | undefined) ??
    (data["transaction_id"] as string | undefined) ??
    (data["referenceId"] as string | undefined) ??
    (nested?.["id"] as string | undefined) ??
    (withdrawal?.["id"] as string | undefined) ??
    undefined;

  const status =
    (data["status"] as string | undefined) ??
    (data["state"] as string | undefined) ??
    (nested?.["status"] as string | undefined) ??
    (withdrawal?.["status"] as string | undefined) ??
    undefined;

  return {
    ...(providerReference ? { providerReference: String(providerReference) } : {}),
    ...(status ? { status: String(status) } : {}),
  };
}

/** Envía un pago MonCash real vía Bazik (POST /moncash/withdraw). */
export async function bazikPayout(input: BazikPayoutInput): Promise<BazikResult> {
  if (input.provider !== "moncash") {
    return {
      ok: false,
      error:
        "Bazik solo soporta MonCash según su spec oficial; NatCash no está confirmado para este proveedor.",
    };
  }
  if (input.currency !== "HTG") {
    return { ok: false, error: "Bazik solo soporta pagos en HTG (gourdes)." };
  }
  if (input.amount > BAZIK_MAX_TRANSACTION_HTG) {
    return {
      ok: false,
      error: `Bazik limita las transacciones a ${BAZIK_MAX_TRANSACTION_HTG} HTG por envío.`,
    };
  }

  const auth = await bazikAuthenticate();
  if (!auth.ok) return { ok: false, error: auth.error };

  const stored = await loadStoredCreds();
  const creds = credsFor(stored);
  const { firstName, lastName } = splitName(input.recipientName);

  const body: Record<string, unknown> = {
    gdes: input.amount,
    wallet: normalisePhoneToMonCashWallet(input.phone),
    description: `Lajan Rapid · ${input.reference}`,
    referenceId: input.reference,
    customerFirstName: firstName,
    customerLastName: lastName,
    webhookUrl: bazikWebhookUrl(),
  };
  if (input.recipientEmail) body["customerEmail"] = input.recipientEmail;

  try {
    const response = await fetch(`${creds.baseUrl}/moncash/withdraw`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      // respuesta no-JSON
    }

    if (!response.ok) {
      console.error(`Bazik /moncash/withdraw falló [${response.status}]: ${text}`);
      return {
        ok: false,
        error: `Bazik rechazó el pago (HTTP ${response.status}): ${text.slice(0, 200)}`,
      };
    }

    const { providerReference, status } = normaliseBazikResult(parsed);
    return {
      ok: true,
      ...(status ? { status } : {}),
      ...(providerReference ? { providerReference } : {}),
      raw: parsed,
    };
  } catch (error) {
    console.error("Bazik /moncash/withdraw lanzó error:", error);
    return { ok: false, error: "No se pudo contactar a Bazik para procesar el pago." };
  }
}

// --- Webhook: recepción de resultados asíncronos ---------------------------

export function bazikStatusLooksSuccessful(status?: string | null): boolean {
  const value = String(status ?? "")
    .trim()
    .toLowerCase();
  if (!value) return false;
  return (
    ["success", "succeeded", "completed", "paid", "approved", "confirmed", "sent"].includes(
      value,
    ) ||
    value.includes("success") ||
    value.includes("complete") ||
    value.includes("paid")
  );
}

export function bazikWebhookState(
  value?: string | null,
): "processing" | "completed" | "cancelled" | null {
  const v = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!v) return null;
  if (bazikStatusLooksSuccessful(value)) return "completed";
  if (
    ["pending", "processing", "in_progress", "queued", "submitted", "created"].includes(v) ||
    v.includes("process") ||
    v.includes("pending")
  ) {
    return "processing";
  }
  if (
    ["failed", "rejected", "cancelled", "canceled", "error", "declined"].includes(v) ||
    v.includes("fail") ||
    v.includes("cancel")
  ) {
    return "cancelled";
  }
  return null;
}

export function bazikExtractReference(payload: unknown): string | null {
  const data = (payload ?? {}) as Record<string, unknown>;
  const nested = (data["data"] as Record<string, unknown> | undefined) ?? undefined;
  const candidate =
    (data["referenceId"] as string | undefined) ??
    (data["reference"] as string | undefined) ??
    (nested?.["referenceId"] as string | undefined) ??
    (nested?.["reference"] as string | undefined) ??
    (data["id"] as string | undefined);
  return candidate ? String(candidate).trim() : null;
}

const BAZIK_STATUS_TEXT: Record<
  "processing" | "completed" | "cancelled",
  { title: string; body: string }
> = {
  processing: { title: "Pago en proceso", body: "Bazik está procesando el envío a MonCash." },
  completed: {
    title: "Pago confirmado",
    body: "Bazik confirmó el envío y ya fue acreditado a la billetera MonCash.",
  },
  cancelled: { title: "Pago rechazado", body: "Bazik no pudo completar el envío." },
};

/** Aplica el resultado de un webhook de Bazik a la transferencia correspondiente. */
export async function applyBazikResult(opts: {
  reference: string;
  state: string;
  providerRef?: string | null;
  detail?: string | null;
}) {
  const next = bazikWebhookState(opts.state);
  if (!next) return { ok: false, reason: `Estado no manejado: ${opts.state}` };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: transfer } = await supabaseAdmin
    .from("transfers")
    .select("id, user_id, status, reference")
    .eq("reference", opts.reference)
    .maybeSingle();

  if (!transfer) return { ok: false, reason: `No existe el envío ${opts.reference}` };
  if (transfer.status === next) return { ok: true, unchanged: true, transferId: transfer.id };
  if (["completed", "processing"].includes(transfer.status) && next === "completed") {
    return { ok: true, unchanged: true, transferId: transfer.id };
  }

  const { error } = await supabaseAdmin
    .from("transfers")
    .update({ status: next })
    .eq("id", transfer.id);

  if (error) {
    console.error("Bazik: no se pudo actualizar el envío", error);
    return { ok: false, reason: error.message };
  }

  await supabaseAdmin.from("transfer_events").insert({
    transfer_id: transfer.id,
    status: next,
    message: `Bazik: ${BAZIK_STATUS_TEXT[next].title}`,
  });

  await supabaseAdmin.from("notifications").insert({
    user_id: transfer.user_id,
    title: `${BAZIK_STATUS_TEXT[next].title} · ${transfer.reference}`,
    body: BAZIK_STATUS_TEXT[next].body,
  });

  return { ok: true, transferId: transfer.id, status: next };
}
