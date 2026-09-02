import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const finalizeSchema = z.object({ transferId: z.string().uuid() });
const adminConfirmSchema = z.object({ transferId: z.string().uuid() });

/** Finaliza el envío pagando automáticamente al MonCash/NatCash del destinatario vía Bazik. */
export const finalizeTransferPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof finalizeSchema>) => finalizeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: t, error } = await context.supabase
      .from("transfers")
      .select(
        "id, user_id, status, reference, recipient_phone, delivery_method, amount_receive, receive_currency",
      )
      .eq("id", data.transferId)
      .maybeSingle();

    if (error || !t) throw new Error("Envío no encontrado");
    if (t.user_id !== context.userId) throw new Error("No autorizado");
    if (t.status === "completed") throw new Error("Este envío ya fue completado");
    if (t.status === "cancelled") throw new Error("Este envío fue cancelado");
    if (t.delivery_method !== "moncash" && t.delivery_method !== "natcash") {
      throw new Error("Este método de entrega no se puede finalizar automáticamente");
    }

    // TODO: la integración con Bazik fue removida; reimplementar el pago automático
    // a MonCash/NatCash aquí antes de habilitar este flujo de nuevo.
    throw new Error(
      "El pago automático a MonCash/NatCash no está disponible por el momento. Un administrador debe confirmarlo manualmente.",
    );
  });

/** Admin confirma una transacción manualmente llamando a Bazik si es MonCash/NatCash. */
export const adminConfirmTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof adminConfirmSchema>) => adminConfirmSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Verificar que es admin
    const { data: isAdminData } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });

    if (!isAdminData) throw new Error("No autorizado");

    const { data: t, error } = await context.supabase
      .from("transfers")
      .select(
        "id, status, reference, recipient_phone, delivery_method, amount_receive, receive_currency",
      )
      .eq("id", data.transferId)
      .maybeSingle();

    if (error || !t) throw new Error("Envío no encontrado");
    if (t.status === "completed") throw new Error("Este envío ya fue completado");
    if (t.status === "cancelled") throw new Error("Este envío fue cancelado");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Si es MonCash/NatCash, el pago automático (antes vía Bazik) fue removido.
    // TODO: reimplementar la integración de payout aquí.
    if (
      (t.delivery_method === "moncash" || t.delivery_method === "natcash") &&
      t.status === "awaiting_payment"
    ) {
      throw new Error(
        "El pago automático a MonCash/NatCash no está disponible por el momento. Márcalo como completado manualmente cuando confirmes el pago.",
      );
    }

    // Si no es MonCash/NatCash o ya está en processing, marcar directo como completed
    await supabaseAdmin.from("transfers").update({ status: "completed" }).eq("id", t.id);

    return {
      ok: true,
      message: "Transacción confirmada",
      status: "completed",
    };
  });
