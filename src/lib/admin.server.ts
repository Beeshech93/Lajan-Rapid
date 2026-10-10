import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function verifyIsAdmin(context: { supabase: any; userId: string }): Promise<boolean> {
  if (!context?.userId) return false;
  try {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (isAdmin) return true;
  } catch {
    // fallback al cliente admin
  }

  try {
    const { data: adminCheck } = await supabaseAdmin.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (adminCheck) return true;
  } catch {
    // fallback a tabla user_roles
  }

  try {
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    return Boolean(roleRow);
  } catch {
    return false;
  }
}

export async function verifyIsStaff(context: { supabase: any; userId: string }): Promise<boolean> {
  if (!context?.userId) return false;
  try {
    const { data: isStaff } = await context.supabase.rpc("is_staff", {
      _user_id: context.userId,
    });
    if (isStaff) return true;
  } catch {
    // fallback
  }

  try {
    const { data: adminCheck } = await supabaseAdmin.rpc("is_staff", {
      _user_id: context.userId,
    });
    if (adminCheck) return true;
  } catch {
    // fallback
  }

  try {
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .in("role", ["admin", "agent"])
      .maybeSingle();
    return Boolean(roleRow);
  } catch {
    return false;
  }
}
