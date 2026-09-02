import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PayWithdrawalInput = { withdrawalId: string };

function parseInput(input: PayWithdrawalInput): PayWithdrawalInput {
  const id = String(input?.withdrawalId ?? "").trim();
  if (!id) throw new Error("Falta el retiro");
  return { withdrawalId: id };
}

/** Paga un retiro a MonCash / NatCash usando Bazik (solo staff). */
export const payCryptoWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parseInput)
  .handler(async ({ data, context }) => {
    const { data: isStaff } = await context.supabase.rpc("is_staff", {
      _user_id: context.userId,
    });
    if (!isStaff) throw new Error("No autorizado");

    const { data: row, error } = await context.supabase
      .from("crypto_withdrawals")
      .select("*")
      .eq("id", data.withdrawalId)
      .maybeSingle();
    if (error || !row) throw new Error("Retiro no encontrado");
    if (row.kind !== "moncash" && row.kind !== "natcash") {
      throw new Error("Solo los retiros MonCash o NatCash se pueden pagar por este medio");
    }
    if (row.status !== "pending" && row.status !== "processing") {
      throw new Error("Retiro ya cerrado");
    }

    // TODO: la integración con Bazik fue removida; reimplementar el pago de
    // retiros MonCash/NatCash aquí antes de habilitar este flujo de nuevo.
    return {
      ok: false,
      error: "El pago automático a MonCash/NatCash no está disponible por el momento.",
    };
  });
