import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function verifyIsAdmin(context: {
  supabase: any;
  userId: string;
  claims?: any;
}): Promise<boolean> {
  if (!context?.userId) return false;

  // 1. Email conocido de administrador / superadmin
  const email = (context.claims?.email || context.claims?.user_metadata?.email || "")
    .toLowerCase()
    .trim();
  const adminEmail = (process.env["ADMIN_ALERT_EMAIL"] || "lajanrapid26@gmail.com")
    .toLowerCase()
    .trim();

  if (email && (email === adminEmail || email === "lajanrapid26@gmail.com")) {
    return true;
  }

  // 2. Rol en claims del JWT
  if (
    context.claims?.role === "admin" ||
    context.claims?.user_metadata?.role === "admin" ||
    context.claims?.app_metadata?.role === "admin"
  ) {
    return true;
  }

  // 3. RPC has_role con cliente de usuario
  try {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (isAdmin) return true;
  } catch {
    // fallback
  }

  // 4. RPC has_role con cliente admin
  try {
    const { data: adminCheck } = await supabaseAdmin.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (adminCheck) return true;
  } catch {
    // fallback
  }

  // 5. Consulta directa a tabla user_roles con supabaseAdmin
  try {
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleRow) return true;
  } catch {
    // fallback
  }

  // 6. Consulta directa a tabla user_roles con cliente del contexto
  try {
    const { data: roleRow } = await context.supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleRow) return true;
  } catch {
    // no autorizado
  }

  return false;
}

export async function verifyIsStaff(context: {
  supabase: any;
  userId: string;
  claims?: any;
}): Promise<boolean> {
  if (!context?.userId) return false;

  const email = (context.claims?.email || context.claims?.user_metadata?.email || "")
    .toLowerCase()
    .trim();
  const adminEmail = (process.env["ADMIN_ALERT_EMAIL"] || "lajanrapid26@gmail.com")
    .toLowerCase()
    .trim();

  if (email && (email === adminEmail || email === "lajanrapid26@gmail.com")) {
    return true;
  }

  if (
    context.claims?.role === "admin" ||
    context.claims?.role === "agent" ||
    context.claims?.user_metadata?.role === "admin" ||
    context.claims?.user_metadata?.role === "agent"
  ) {
    return true;
  }

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
    if (roleRow) return true;
  } catch {
    // fallback
  }

  try {
    const { data: roleRow } = await context.supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .in("role", ["admin", "agent"])
      .maybeSingle();
    if (roleRow) return true;
  } catch {
    // fallback
  }

  return false;
}
