// Selección del proveedor de tarjetas por configuración.
// CARD_PROVIDER = mock | visa | mastercard

import type { CardProvider, CardProviderName } from "./card-provider.interface";
import { mockCardProvider } from "./mock.provider.server";
import { mastercardCardProvider, visaCardProvider } from "./network.provider.server";

export const CARD_CONFIG_NAMES = [
  "CARD_PROVIDER",
  "VISA_ENABLED",
  "MASTERCARD_ENABLED",
  "VISA_BASE_URL",
  "VISA_API_KEY",
  "VISA_USER_ID",
  "MASTERCARD_BASE_URL",
  "MASTERCARD_API_KEY",
  "MASTERCARD_CLIENT_ID",
  "MASTERCARD_CLIENT_SECRET",
] as const;

export type CardConfigName = (typeof CARD_CONFIG_NAMES)[number];

async function loadConfig(): Promise<Record<string, string>> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("integration_credentials")
      .select("name, value")
      .in("name", [...CARD_CONFIG_NAMES]);
    const out: Record<string, string> = {};
    for (const row of data ?? []) if (row.value) out[row.name] = row.value;
    return out;
  } catch (e) {
    console.error("No se pudo leer la configuración del programa de tarjetas", e);
    return {};
  }
}

function readConfig(stored: Record<string, string>, name: CardConfigName) {
  return process.env[name] ?? stored[name];
}

export async function resolveCardProviderName(): Promise<CardProviderName> {
  const stored = await loadConfig();
  const raw = (readConfig(stored, "CARD_PROVIDER") ?? "mock").toLowerCase();
  if (raw === "visa" && readConfig(stored, "VISA_ENABLED") === "true") return "visa";
  if (raw === "mastercard" && readConfig(stored, "MASTERCARD_ENABLED") === "true") {
    return "mastercard";
  }
  return raw === "visa" || raw === "mastercard" ? raw : "mock";
}

export function providerByName(name: CardProviderName): CardProvider {
  if (name === "visa") return visaCardProvider;
  if (name === "mastercard") return mastercardCardProvider;
  return mockCardProvider;
}

export async function getCardProvider(): Promise<CardProvider> {
  return providerByName(await resolveCardProviderName());
}

/** Resumen para el panel de administración. */
export async function cardProgramStatus() {
  const stored = await loadConfig();
  const name = await resolveCardProviderName();
  return {
    provider: name,
    live: providerByName(name).live,
    visaEnabled: readConfig(stored, "VISA_ENABLED") === "true",
    mastercardEnabled: readConfig(stored, "MASTERCARD_ENABLED") === "true",
    hasVisaCredentials: Boolean(readConfig(stored, "VISA_API_KEY")),
    hasMastercardCredentials: Boolean(readConfig(stored, "MASTERCARD_API_KEY")),
    requiresApproval: name !== "mock",
  };
}

export async function saveCardConfig(name: string, value: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!value) {
    await supabaseAdmin.from("integration_credentials").delete().eq("name", name);
    return;
  }
  await supabaseAdmin
    .from("integration_credentials")
    .upsert({ name, value, updated_at: new Date().toISOString(), updated_by: userId });
}
