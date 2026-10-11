// Verificación de roles en el servidor. El userId ya viene validado por
// requireSupabaseAuth; los roles se leen SOLO de la tabla user_roles
// (nunca de correos, metadatos del usuario ni claims editables).

type Ctx = { supabase: any; userId: string; claims?: any };

async function hasAnyRole(context: Ctx, roles: string[]): Promise<boolean> {
  if (!context?.userId) return false;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .in("role", roles as any)
      .limit(1);
    return Boolean(data && data.length > 0);
  } catch (e) {
    console.error("No se pudo verificar el rol", e);
    return false;
  }
}

export function verifyIsAdmin(context: Ctx): Promise<boolean> {
  return hasAnyRole(context, ["admin"]);
}

export function verifyIsStaff(context: Ctx): Promise<boolean> {
  return hasAnyRole(context, ["admin", "agent"]);
}
