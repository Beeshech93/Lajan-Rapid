import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  parseBazikCredentialsInput,
  parseBazikPayoutInput,
  type BazikCredentialsInput,
  type BazikPayoutRequest,
} from "@/lib/bazik.schemas";

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

/** Cotización real de un envío MonCash / NatCash (solo administradores). */
export const bazikQuoteTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { amount: number; provider: "moncash" | "natcash" }) => {
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Monto inválido");
    if (input.provider !== "moncash" && input.provider !== "natcash") {
      throw new Error("Proveedor inválido");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("No autorizado");
    const { bazikQuote } = await import("@/lib/bazik.server");
    return bazikQuote(data.amount, data.provider);
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
