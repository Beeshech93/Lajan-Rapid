// Conector del proveedor emisor de tarjetas virtuales.
// Los datos sensibles (PAN completo y CVV) NUNCA se guardan en la base de datos:
// se piden al emisor en el momento y se devuelven solo al dueño de la tarjeta.

export const CARD_CRED_NAMES = ["CARD_API_BASE_URL", "CARD_API_KEY", "CARD_API_SECRET"] as const;

export type CardCredName = (typeof CARD_CRED_NAMES)[number];

export type CardSecureDetails = {
  ok: boolean;
  configured: boolean;
  pan?: string;
  cvv?: string;
  expMonth?: number;
  expYear?: number;
  holder?: string;
  status?: string;
  error?: string;
};

async function loadCreds(): Promise<Record<string, string>> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("integration_credentials")
      .select("name, value")
      .in("name", [...CARD_CRED_NAMES]);
    const out: Record<string, string> = {};
    for (const row of data ?? []) if (row.value) out[row.name] = row.value;
    return out;
  } catch (e) {
    console.error("No se pudieron leer las credenciales del emisor de tarjetas", e);
    return {};
  }
}

export async function saveCardCred(name: string, value: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!value) {
    await supabaseAdmin.from("integration_credentials").delete().eq("name", name);
    return;
  }
  await supabaseAdmin
    .from("integration_credentials")
    .upsert({ name, value, updated_at: new Date().toISOString(), updated_by: userId });
}

function pick(stored: Record<string, string>, name: string) {
  return process.env[name] ?? stored[name];
}

function baseUrl(stored: Record<string, string>) {
  return (pick(stored, "CARD_API_BASE_URL") ?? "https://api.bazik.io").replace(/\/$/, "");
}

/** Estado de la conexión con el emisor (panel de administración). */
export async function cardIssuerStatusInfo() {
  const stored = await loadCreds();
  const url = baseUrl(stored);
  return {
    baseUrl: url,
    hasKey: Boolean(pick(stored, "CARD_API_KEY")),
    hasSecret: Boolean(pick(stored, "CARD_API_SECRET")),
    configured: Boolean(pick(stored, "CARD_API_KEY")),
    detailsEndpoint: `${url}/v1/cards/{provider_card_id}/secure-details`,
    names: {
      baseUrlName: "CARD_API_BASE_URL",
      keyName: "CARD_API_KEY",
      secretName: "CARD_API_SECRET",
    },
  };
}

/** Pide al emisor los datos completos de una tarjeta (PAN y CVV en tránsito, sin persistir). */
export async function fetchCardSecureDetails(providerCardId: string): Promise<CardSecureDetails> {
  const stored = await loadCreds();
  const key = pick(stored, "CARD_API_KEY");
  const secret = pick(stored, "CARD_API_SECRET");
  if (!key) {
    return {
      ok: false,
      configured: false,
      error: "El emisor de tarjetas todavía no está conectado.",
    };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
    "X-Api-Key": key,
  };
  if (secret) headers["X-Api-Secret"] = secret;

  try {
    const response = await fetch(
      `${baseUrl(stored)}/v1/cards/${encodeURIComponent(providerCardId)}/secure-details`,
      { method: "GET", headers },
    );
    const text = await response.text();
    if (!response.ok) {
      console.error(`Emisor de tarjetas falló [${response.status}]`);
      return { ok: false, configured: true, error: `Emisor [${response.status}]` };
    }
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { ok: false, configured: true, error: "Respuesta inválida del emisor" };
    }
    const d = (parsed["data"] ?? parsed) as Record<string, unknown>;
    return {
      ok: true,
      configured: true,
      ...(typeof d["pan"] === "string" ? { pan: d["pan"] } : {}),
      ...(typeof d["cvv"] === "string" ? { cvv: d["cvv"] } : {}),
      ...(typeof d["exp_month"] === "number" ? { expMonth: d["exp_month"] } : {}),
      ...(typeof d["exp_year"] === "number" ? { expYear: d["exp_year"] } : {}),
      ...(typeof d["holder"] === "string" ? { holder: d["holder"] } : {}),
      ...(typeof d["status"] === "string" ? { status: d["status"] } : {}),
    };
  } catch (e) {
    console.error("Error llamando al emisor de tarjetas", e);
    return { ok: false, configured: true, error: "No se pudo contactar al emisor" };
  }
}
