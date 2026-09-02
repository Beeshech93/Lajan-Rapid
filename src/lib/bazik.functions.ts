import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseBazikCredentialsInput, type BazikCredentialsInput } from "@/lib/bazik.schemas";

async function requireAdmin(context: { supabase: unknown; userId: string }) {
  const supabase = context.supabase as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
  };
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("No autorizado");
}

/** Estado de configuración y autenticación del conector Bazik (solo administradores). */
export const bazikStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { bazikStatusInfo } = await import("@/lib/bazik.server");
    return bazikStatusInfo();
  });

/** Prueba la autenticación contra Bazik forzando un nuevo token (solo administradores). */
export const bazikTestAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { bazikAuthenticate } = await import("@/lib/bazik.server");
    return bazikAuthenticate(true);
  });

/** Guarda manualmente las credenciales de Bazik (solo administradores). */
export const bazikSaveCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: BazikCredentialsInput) => parseBazikCredentialsInput(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { saveStoredCred } = await import("@/lib/bazik.server");
    for (const [name, value] of Object.entries(data)) {
      if (value === undefined) continue;
      await saveStoredCred(name, value.trim(), context.userId);
    }
    return { ok: true };
  });
