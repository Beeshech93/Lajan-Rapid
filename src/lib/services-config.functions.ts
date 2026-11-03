import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ServiceKey = "transfers" | "topups" | "crypto";

export type ServiceItemConfig = {
  enabled: boolean;
  message: string;
};

export type ServicesConfig = Record<ServiceKey, ServiceItemConfig>;

const SERVICE_KEYS = {
  transfers: {
    enabled: "SERVICE_TRANSFERS_ENABLED",
    message: "SERVICE_TRANSFERS_MESSAGE",
  },
  topups: {
    enabled: "SERVICE_TOPUPS_ENABLED",
    message: "SERVICE_TOPUPS_MESSAGE",
  },
  crypto: {
    enabled: "SERVICE_CRYPTO_ENABLED",
    message: "SERVICE_CRYPTO_MESSAGE",
  },
} as const;

const ALL_DB_KEYS = [
  SERVICE_KEYS.transfers.enabled,
  SERVICE_KEYS.transfers.message,
  SERVICE_KEYS.topups.enabled,
  SERVICE_KEYS.topups.message,
  SERVICE_KEYS.crypto.enabled,
  SERVICE_KEYS.crypto.message,
];

const DEFAULT_CONFIG: ServicesConfig = {
  transfers: { enabled: true, message: "" },
  topups: { enabled: true, message: "" },
  crypto: { enabled: true, message: "" },
};

export const getServicesConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<ServicesConfig> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin
        .from("integration_credentials")
        .select("name, value")
        .in("name", ALL_DB_KEYS);

      if (error) {
        console.error("Error reading services config:", error.message);
        return DEFAULT_CONFIG;
      }

      const map = new Map((data ?? []).map((row) => [row.name, row.value]));

      const parseService = (key: ServiceKey): ServiceItemConfig => {
        const enabledRaw = map.get(SERVICE_KEYS[key].enabled);
        const messageRaw = map.get(SERVICE_KEYS[key].message) ?? "";
        // Si no está definido en la base de datos, por defecto está habilitado (true)
        const enabled = enabledRaw === undefined ? true : enabledRaw !== "false";
        return {
          enabled,
          message: messageRaw,
        };
      };

      return {
        transfers: parseService("transfers"),
        topups: parseService("topups"),
        crypto: parseService("crypto"),
      };
    } catch (e: any) {
      console.error("Error in getServicesConfig:", e?.message || e);
      return DEFAULT_CONFIG;
    }
  },
);

export const updateServicesConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: Partial<ServicesConfig>) => input)
  .handler(async ({ data, context }) => {
    const { verifyIsAdmin } = await import("@/lib/admin.server");
    const isAdmin = await verifyIsAdmin(context);
    if (!isAdmin) throw new Error("No autorizado");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const rows: { name: string; value: string; updated_at: string; updated_by: string }[] = [];

    const keys: ServiceKey[] = ["transfers", "topups", "crypto"];
    for (const k of keys) {
      const item = data[k];
      if (!item) continue;

      if (typeof item.enabled === "boolean") {
        rows.push({
          name: SERVICE_KEYS[k].enabled,
          value: item.enabled ? "true" : "false",
          updated_at: now,
          updated_by: context.userId,
        });
      }

      if (typeof item.message === "string") {
        rows.push({
          name: SERVICE_KEYS[k].message,
          value: item.message.trim(),
          updated_at: now,
          updated_by: context.userId,
        });
      }
    }

    if (rows.length > 0) {
      let upsertError: any;
      try {
        const res = await context.supabase
          .from("integration_credentials")
          .upsert(rows, { onConflict: "name" });
        upsertError = res.error;
      } catch (e: any) {
        upsertError = e;
      }

      if (upsertError) {
        try {
          const res = await supabaseAdmin
            .from("integration_credentials")
            .upsert(rows, { onConflict: "name" });
          upsertError = res.error;
        } catch (e: any) {
          upsertError = e;
        }
      }

      if (upsertError) {
        throw new Error(upsertError.message || String(upsertError));
      }
    }

    return { ok: true };
  });

