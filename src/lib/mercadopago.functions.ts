import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseMpCredentialsInput, type MpCredentialsInput } from "@/lib/mercadopago.schemas";

/** Estado de configuración de Mercado Pago (solo administradores). */
export const mercadoPagoStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("No autorizado");
    const { mpStatusInfo } = await import("@/lib/mercadopago.server");
    return mpStatusInfo();
  });

/** Guardar manualmente las credenciales de Mercado Pago (solo administradores). */
export const mercadoPagoSaveCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: MpCredentialsInput) => parseMpCredentialsInput(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("No autorizado");
    const { saveMpCred } = await import("@/lib/mercadopago.server");
    for (const [name, value] of Object.entries(data)) {
      if (value === undefined) continue;
      await saveMpCred(name, value.trim(), context.userId);
    }
    return { ok: true };
  });
