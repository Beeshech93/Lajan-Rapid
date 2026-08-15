import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SupportConfig = {
  whatsapp_number: string;
  email: string;
  support_hours: string;
  timezone: string;
};

const KEYS = {
  whatsapp_number: "SUPPORT_WHATSAPP_NUMBER",
  email: "SUPPORT_EMAIL",
  support_hours: "SUPPORT_HOURS",
  timezone: "SUPPORT_TIMEZONE",
} as const;

export const getSupportConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<SupportConfig> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("integration_credentials")
      .select("name, value")
      .in("name", Object.values(KEYS));

    if (error) console.error("Error getting support config:", error.message);

    const stored = new Map((data ?? []).map((row) => [row.name, row.value]));
    return {
      whatsapp_number: stored.get(KEYS.whatsapp_number) ?? "",
      email: stored.get(KEYS.email) ?? "",
      support_hours: stored.get(KEYS.support_hours) ?? "24/7",
      timezone: stored.get(KEYS.timezone) ?? "UTC",
    };
  },
);

export const updateSupportConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Partial<SupportConfig>) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("No autorizado");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = (Object.keys(KEYS) as (keyof SupportConfig)[])
      .filter((field) => typeof data[field] === "string")
      .map((field) => ({
        name: KEYS[field],
        value: (data[field] as string).trim(),
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      }));

    if (rows.length > 0) {
      const { error } = await supabaseAdmin.from("integration_credentials").upsert(rows);
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });
