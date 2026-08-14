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

function pickFirstString(value: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    const candidate = value[name];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return undefined;
}

function pickFirstNumber(value: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    const candidate = value[name];
    if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
    if (typeof candidate === "string" && candidate.trim()) {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function parseExpiry(value: unknown): { expMonth?: number; expYear?: number } | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim();
  if (!cleaned) return undefined;

  const mmSlash = cleaned.match(/^(\d{1,2})\s*[/\-]\s*(\d{2}|\d{4})$/);
  if (mmSlash) {
    const month = Number(mmSlash[1]);
    const yearPart = mmSlash[2];
    if (month >= 1 && month <= 12) {
      return {
        expMonth: month,
        expYear: yearPart.length === 2 ? 2000 + Number(yearPart) : Number(yearPart),
      };
    }
  }

  const yyyyMm = cleaned.match(/^(\d{4})\s*[-/]\s*(\d{1,2})$/);
  if (yyyyMm) {
    const year = Number(yyyyMm[1]);
    const month = Number(yyyyMm[2]);
    if (month >= 1 && month <= 12) {
      return { expMonth: month, expYear: year };
    }
  }

  const mmYy = cleaned.match(/^(\d{1,2})\s*(?:\/|-)\s*(\d{2})$/);
  if (mmYy) {
    const month = Number(mmYy[1]);
    const year = Number(mmYy[2]);
    if (month >= 1 && month <= 12) {
      return { expMonth: month, expYear: 2000 + year };
    }
  }

  return undefined;
}

function normalizeSecurePayload(raw: Record<string, unknown>): Partial<CardSecureDetails> {
  const card = ((raw.data ?? raw.details ?? raw.card ?? raw) as Record<string, unknown>) ?? {};

  const expiryFromField = parseExpiry(card["expiry"] ?? card["expiration"] ?? card["exp"]);
  const month = pickFirstNumber(card, ["exp_month", "expiry_month", "expiration_month", "expMonth"]);
  const year = pickFirstNumber(card, ["exp_year", "expiry_year", "expiration_year", "expYear"]);
  const pan = pickFirstString(card, ["pan", "number", "card_number", "full_number", "cardNumber"]);
  const cvv = pickFirstString(card, ["cvv", "cvc", "security_code", "code"]);
  const holder = pickFirstString(card, [
    "holder",
    "cardholder",
    "card_holder",
    "name",
    "full_name",
    "fullName",
    "card_name",
  ]);
  const status = pickFirstString(card, ["status", "state"]);

  return {
    pan: pan ?? undefined,
    cvv: cvv ?? undefined,
    expMonth: month ?? expiryFromField?.expMonth,
    expYear: year ?? expiryFromField?.expYear,
    holder: holder ?? undefined,
    status: status ?? undefined,
  };
}

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
    const normalized = normalizeSecurePayload(parsed as Record<string, unknown>);
    return {
      ok: true,
      configured: true,
      ...(normalized.pan ? { pan: normalized.pan } : {}),
      ...(normalized.cvv ? { cvv: normalized.cvv } : {}),
      ...(normalized.expMonth !== undefined ? { expMonth: normalized.expMonth } : {}),
      ...(normalized.expYear !== undefined ? { expYear: normalized.expYear } : {}),
      ...(normalized.holder ? { holder: normalized.holder } : {}),
      ...(normalized.status ? { status: normalized.status } : {}),
    };
  } catch (e) {
    console.error("Error llamando al emisor de tarjetas", e);
    return { ok: false, configured: true, error: "No se pudo contactar al emisor" };
  }
}
