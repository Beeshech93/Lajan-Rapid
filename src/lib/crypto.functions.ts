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
      throw new Error("Solo los retiros MonCash o NatCash se pagan con Bazik");
    }
    if (row.status !== "pending" && row.status !== "processing") {
      throw new Error("Retiro ya cerrado");
    }

    const { bazikPayout } = await import("@/lib/bazik.server");
    const result = await bazikPayout({
      provider: row.kind,
      phone: row.destination,
      amount: Number(row.amount_htg),
      currency: "HTG",
      reference: row.reference,
    });

    if (!result.ok) {
      return { ok: false, error: result.error ?? "Bazik rechazó el pago" };
    }

    await context.supabase.rpc("settle_crypto_withdrawal", {
      _id: row.id,
      _status: "completed",
      _notes: "Pagado vía Bazik",
      _provider_ref: result.providerReference ?? row.reference,
    });

    return { ok: true, providerReference: result.providerReference ?? row.reference };
  });
