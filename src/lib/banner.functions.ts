import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BannerType = "text" | "image";

export type BannerConfig = {
  enabled: boolean;
  type: BannerType;
  text: string;
  image_url: string;
  link_url: string;
};

const KEYS = {
  enabled: "AD_BANNER_ENABLED",
  type: "AD_BANNER_TYPE",
  text: "AD_BANNER_TEXT",
  image_url: "AD_BANNER_IMAGE_URL",
  link_url: "AD_BANNER_LINK_URL",
} as const;

export const getBannerConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<BannerConfig> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("integration_credentials")
      .select("name, value")
      .in("name", Object.values(KEYS));

    if (error) console.error("Error getting banner config:", error.message);

    const stored = new Map((data ?? []).map((row) => [row.name, row.value]));
    const type = stored.get(KEYS.type);
    return {
      enabled: stored.get(KEYS.enabled) === "true",
      type: type === "image" ? "image" : "text",
      text: stored.get(KEYS.text) ?? "",
      image_url: stored.get(KEYS.image_url) ?? "",
      link_url: stored.get(KEYS.link_url) ?? "",
    };
  },
);

export const updateBannerConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Partial<BannerConfig>) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("No autorizado");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const rows: { name: string; value: string; updated_at: string; updated_by: string }[] = [];

    if (typeof data.enabled === "boolean") {
      rows.push({
        name: KEYS.enabled,
        value: String(data.enabled),
        updated_at: now,
        updated_by: context.userId,
      });
    }
    if (data.type === "text" || data.type === "image") {
      rows.push({ name: KEYS.type, value: data.type, updated_at: now, updated_by: context.userId });
    }
    (["text", "image_url", "link_url"] as const).forEach((field) => {
      if (typeof data[field] === "string") {
        rows.push({
          name: KEYS[field],
          value: data[field]!.trim(),
          updated_at: now,
          updated_by: context.userId,
        });
      }
    });

    if (rows.length > 0) {
      const sb = (context.supabase as any) ?? (await import("@/integrations/supabase/client.server")).supabaseAdmin;
      const { error } = await sb.from("integration_credentials").upsert(rows);
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });
