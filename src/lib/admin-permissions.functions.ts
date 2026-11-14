import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminTabId =
  | "resumen"
  | "servicios"
  | "contabilidad"
  | "soporte"
  | "banner"
  | "mercadopago"
  | "stripe"
  | "resend"
  | "bulk-email"
  | "security"
  | "operators"
  | "topup-rates"
  | "dingconnect"
  | "cripto"
  | "bazik"
  | "kyc"
  | "tx"
  | "recargas"
  | "usuarios"
  | "tarifas"
  | "migracion";

export interface AdminPermissionsConfig {
  isSuperAdmin: boolean;
  allowedTabs: AdminTabId[];
  updatedAt?: string;
  updatedBy?: string;
}

export const ALL_ADMIN_TAB_IDS: AdminTabId[] = [
  "resumen",
  "servicios",
  "contabilidad",
  "soporte",
  "banner",
  "mercadopago",
  "stripe",
  "resend",
  "bulk-email",
  "security",
  "operators",
  "topup-rates",
  "dingconnect",
  "cripto",
  "bazik",
  "kyc",
  "tx",
  "recargas",
  "usuarios",
  "tarifas",
  "migracion",
];

const MASTER_ADMIN_EMAIL = "lajanrapid26@gmail.com";

export function getAdminPermissionsStorageKey(userId: string): string {
  return `ADMIN_PERMISSIONS_${userId}`;
}

/**
 * Obtiene los permisos del administrador actual autenticado.
 */
export const getMyPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminPermissionsConfig> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verificar si es master admin
    const email = String(context.claims?.email ?? "").toLowerCase().trim();
    if (email === MASTER_ADMIN_EMAIL) {
      return { isSuperAdmin: true, allowedTabs: ALL_ADMIN_TAB_IDS };
    }

    // Verificar si tiene rol admin en user_roles
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      return { isSuperAdmin: false, allowedTabs: [] };
    }

    // Leer restricciones de integration_credentials
    const key = getAdminPermissionsStorageKey(context.userId);
    const { data: permRow } = await supabaseAdmin
      .from("integration_credentials")
      .select("value")
      .eq("name", key)
      .maybeSingle();

    if (!permRow?.value) {
      // Por defecto, si no tiene restricciones explícitas guardadas, es Super Admin
      return { isSuperAdmin: true, allowedTabs: ALL_ADMIN_TAB_IDS };
    }

    try {
      const parsed = JSON.parse(permRow.value) as Partial<AdminPermissionsConfig>;
      if (parsed.isSuperAdmin) {
        return { isSuperAdmin: true, allowedTabs: ALL_ADMIN_TAB_IDS };
      }
      const allowed = Array.isArray(parsed.allowedTabs)
        ? (parsed.allowedTabs.filter((t) => ALL_ADMIN_TAB_IDS.includes(t as AdminTabId)) as AdminTabId[])
        : [];
      return {
        isSuperAdmin: false,
        allowedTabs: allowed,
        updatedAt: parsed.updatedAt,
        updatedBy: parsed.updatedBy,
      };
    } catch {
      return { isSuperAdmin: true, allowedTabs: ALL_ADMIN_TAB_IDS };
    }
  });

/**
 * Obtiene el mapa de permisos de todos los administradores.
 */
export const getAllAdminsPermissionsMap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Record<string, AdminPermissionsConfig>> => {
    const { verifyIsAdmin } = await import("@/lib/admin.server");
    if (!(await verifyIsAdmin(context))) throw new Error("No autorizado");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("integration_credentials")
      .select("name, value")
      .like("name", "ADMIN_PERMISSIONS_%");

    const result: Record<string, AdminPermissionsConfig> = {};
    for (const r of rows ?? []) {
      const userId = r.name.replace("ADMIN_PERMISSIONS_", "");
      try {
        const parsed = JSON.parse(r.value);
        result[userId] = {
          isSuperAdmin: Boolean(parsed.isSuperAdmin),
          allowedTabs: Array.isArray(parsed.allowedTabs) ? parsed.allowedTabs : [],
          updatedAt: parsed.updatedAt,
          updatedBy: parsed.updatedBy,
        };
      } catch {
        result[userId] = { isSuperAdmin: true, allowedTabs: ALL_ADMIN_TAB_IDS };
      }
    }
    return result;
  });

export interface SetUserRoleAndPermissionsInput {
  targetUserId: string;
  role: "admin" | "agent" | "client";
  isSuperAdmin?: boolean;
  allowedTabs?: AdminTabId[];
}

/**
 * Guarda o modifica el rol de un usuario y sus permisos/restricciones si es admin.
 */
export const setUserRoleAndPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: SetUserRoleAndPermissionsInput) => input)
  .handler(async ({ data: input, context }) => {
    const { verifyIsAdmin } = await import("@/lib/admin.server");
    if (!(await verifyIsAdmin(context))) throw new Error("No autorizado");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Proteger al administrador principal
    const { data: targetUser } = await supabaseAdmin.auth.admin.getUserById(input.targetUserId);
    const targetEmail = String(targetUser?.user?.email ?? "").toLowerCase().trim();

    if (targetEmail === MASTER_ADMIN_EMAIL && input.role !== "admin") {
      throw new Error("No se puede revocar el rol de administrador a la cuenta principal de Lajan Rapid.");
    }

    const now = new Date().toISOString();

    // 1. Manejo del rol en user_roles
    if (input.role === "client") {
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", input.targetUserId)
        .in("role", ["admin", "agent"] as any);

      // Eliminar registro de permisos
      await supabaseAdmin
        .from("integration_credentials")
        .delete()
        .eq("name", getAdminPermissionsStorageKey(input.targetUserId));
    } else if (input.role === "agent") {
      // Asegurar que tenga agent y no admin
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", input.targetUserId)
        .eq("role", "admin" as any);

      const { data: existingAgent } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", input.targetUserId)
        .eq("role", "agent" as any)
        .maybeSingle();

      if (!existingAgent) {
        await supabaseAdmin.from("user_roles").insert({
          user_id: input.targetUserId,
          role: "agent" as any,
        });
      }

      await supabaseAdmin
        .from("integration_credentials")
        .delete()
        .eq("name", getAdminPermissionsStorageKey(input.targetUserId));
    } else if (input.role === "admin") {
      // Asegurar que tenga el rol admin en user_roles
      const { data: existingAdmin } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", input.targetUserId)
        .eq("role", "admin" as any)
        .maybeSingle();

      if (!existingAdmin) {
        await supabaseAdmin.from("user_roles").insert({
          user_id: input.targetUserId,
          role: "admin" as any,
        });
      }

      // 2. Guardar permisos en integration_credentials
      const permKey = getAdminPermissionsStorageKey(input.targetUserId);
      const isSuper = targetEmail === MASTER_ADMIN_EMAIL ? true : Boolean(input.isSuperAdmin);
      const tabs = isSuper ? ALL_ADMIN_TAB_IDS : (input.allowedTabs ?? []);

      const permConfig: AdminPermissionsConfig = {
        isSuperAdmin: isSuper,
        allowedTabs: tabs,
        updatedAt: now,
        updatedBy: context.userId,
      };

      await supabaseAdmin
        .from("integration_credentials")
        .upsert(
          {
            name: permKey,
            value: JSON.stringify(permConfig),
            updated_at: now,
            updated_by: context.userId,
          },
          { onConflict: "name" },
        );
    }

    return { ok: true };
  });
