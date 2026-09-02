import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseStripeCredentialsInput, type StripeCredentialsInput } from "@/lib/stripe.schemas";

/** Estado de configuración de Stripe (solo administradores). */
export const stripeStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("No autorizado");
    const { stripeStatusInfo } = await import("@/lib/stripe.server");
    return stripeStatusInfo();
  });

/** Guardar manualmente las credenciales de Stripe (solo administradores). */
export const stripeSaveCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: StripeCredentialsInput) => parseStripeCredentialsInput(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("No autorizado");
    const { saveStripeCred } = await import("@/lib/stripe.server");
    for (const [name, value] of Object.entries(data)) {
      if (value === undefined) continue;
      await saveStripeCred(name, value.trim(), context.userId);
    }
    return { ok: true };
  });
