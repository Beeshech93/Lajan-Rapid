import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  parseBazikCredentialsInput,
  parseBazikPayoutInput,
  parseBazikTopupInput,
  type BazikCredentialsInput,
  type BazikPayoutRequest,
  type BazikTopupRequest,
} from "@/lib/bazik.schemas";


/** Recarga de billetera con Bazik. */
export const bazikTopupWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: BazikTopupRequest) => parseBazikTopupInput(input))
  .handler(async ({ data, context }) => {
    const { bazikTopup } = await import("@/lib/bazik.server");
    const reference = `LR-TOP-${Date.now().toString(36).toUpperCase()}`;
    const result = await bazikTopup({
      walletId: data.walletId,
      amount: data.amount,
      currency: data.currency,
      reference,
    });
    return { ...result, reference, userId: context.userId };
  });

/** Envío a MonCash o NatCash con Bazik. */
export const bazikSendMobileMoney = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: BazikPayoutRequest) => parseBazikPayoutInput(input))
  .handler(async ({ data, context }) => {
    const { bazikPayout } = await import("@/lib/bazik.server");
    const reference = `LR-PAY-${Date.now().toString(36).toUpperCase()}`;
    const result = await bazikPayout({
      provider: data.provider,
      phone: data.phone,
      amount: data.amount,
      currency: data.currency,
      reference,
    });
    return { ...result, reference, userId: context.userId };
  });

/** Estado de configuración del conector Bazik (solo administradores). */
export const bazikStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("No autorizado");
    const { bazikStatusInfo } = await import("@/lib/bazik.server");
    return bazikStatusInfo();
  });

/** Guardar manualmente las credenciales de Bazik (solo administradores). */
export const bazikSaveCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: BazikCredentialsInput) => parseBazikCredentialsInput(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("No autorizado");
    const { saveStoredCred } = await import("@/lib/bazik.server");
    for (const [name, value] of Object.entries(data)) {
      if (value === undefined) continue;
      await saveStoredCred(name, value.trim(), context.userId);
    }
    return { ok: true };
  });

