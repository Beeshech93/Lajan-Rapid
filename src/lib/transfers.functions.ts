import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const finalizeSchema = z.object({ transferId: z.string().uuid() });
const adminConfirmSchema = z.object({ transferId: z.string().uuid() });
const TRANSFER_STATUSES = [
  "created",
  "awaiting_payment",
  "paid",
  "processing",
  "ready_for_pickup",
  "completed",
  "cancelled",
] as const;
const adminSetStatusSchema = z.object({
  transferId: z.string().uuid(),
  status: z.enum(TRANSFER_STATUSES),
  note: z.string().trim().max(500).optional(),
});
const adminCancelSchema = z.object({
  transferId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});

const ADMIN_STATUS_LABEL: Record<string, string> = {
  created: "Creado",
  awaiting_payment: "Esperando pago",
  paid: "Pago confirmado",
  processing: "En proceso",
  ready_for_pickup: "Listo para retirar",
  completed: "Entregado",
  cancelled: "Cancelado",
};

/**
 * Cambia la etapa de una transacción manualmente a cualquier estado, sin
 * disparar el pago automático de Bazik. Uso: cuando el admin ya gestionó el
 * pago por fuera del sistema, o necesita corregir el estado.
 */
export const adminSetTransferStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof adminSetStatusSchema>) =>
    adminSetStatusSchema.parse(input),
  )
  .handler(async ({ data, context }) => {
    const { verifyIsAdmin } = await import("@/lib/admin.server");
    const isAdminData = await verifyIsAdmin(context);
    if (!isAdminData) throw new Error("No autorizado");

    const { data: t, error } = await context.supabase
      .from("transfers")
      .select("id, user_id, status, reference, delivery_method")
      .eq("id", data.transferId)
      .maybeSingle();

    if (error || !t) throw new Error("Envío no encontrado");
    if (t.status === data.status) {
      return { ok: true, message: "Ya estaba en esa etapa", status: data.status };
    }

    // La edición manual no debe saltarse los controles de pago ni el webhook
    // autenticado de Bazik para marcar un envío como entregado.
    const isBazikPayout = ["moncash", "natcash"].includes(String(t.delivery_method ?? "").toLowerCase());
    if (data.status === "completed" && t.status !== "paid") {
      throw new Error("Solo se puede completar un envío cuando el pago está confirmado.");
    }
    if (isBazikPayout && t.status === "processing") {
      throw new Error("No se puede cambiar manualmente un payout de Bazik en proceso; espera el webhook o reconcilia el estado con el proveedor.");
    }
    if (isBazikPayout && data.status === "completed") {
      throw new Error("Los envíos de Bazik solo pueden completarse mediante un webhook válido del proveedor.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: updateError } = await supabaseAdmin
      .from("transfers")
      .update({ status: data.status })
      .eq("id", t.id)
      .eq("status", t.status);
    if (updateError) throw new Error(updateError.message);

    const label = ADMIN_STATUS_LABEL[data.status] ?? data.status;
    const eventMessage = data.note
      ? `Etapa cambiada manualmente a "${label}": ${data.note}`
      : `Etapa cambiada manualmente a "${label}"`;

    await supabaseAdmin.from("transfer_events").insert({
      transfer_id: t.id,
      status: data.status,
      message: eventMessage,
    });

    await supabaseAdmin.from("notifications").insert({
      user_id: t.user_id,
      title: `${label} · ${t.reference}`,
      body: data.note ?? `El estado de tu envío cambió a "${label}".`,
    });

    return { ok: true, message: `Etapa actualizada a "${label}"`, status: data.status };
  });

/** Cancela una transacción. No puede cancelarse un envío ya completado. */
export const adminCancelTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof adminCancelSchema>) => adminCancelSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { verifyIsAdmin } = await import("@/lib/admin.server");
    const isAdminData = await verifyIsAdmin(context);
    if (!isAdminData) throw new Error("No autorizado");

    const { data: t, error } = await context.supabase
      .from("transfers")
      .select("id, user_id, status, reference, delivery_method")
      .eq("id", data.transferId)
      .maybeSingle();

    if (error || !t) throw new Error("Envío no encontrado");
    if (t.status === "completed") throw new Error("No se puede cancelar un envío ya entregado");
    const isBazikPayout = ["moncash", "natcash"].includes(String(t.delivery_method ?? "").toLowerCase());
    if (isBazikPayout && t.status === "processing") {
      throw new Error("No se puede cancelar manualmente un payout de Bazik en proceso; primero reconcilia su estado con el proveedor.");
    }
    if (t.status === "cancelled") {
      return { ok: true, message: "Ya estaba cancelado", status: "cancelled" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cancelled, error: updateError } = await supabaseAdmin
      .from("transfers")
      .update({ status: "cancelled" })
      .eq("id", t.id)
      .eq("status", t.status)
      .select("id")
      .maybeSingle();
    if (updateError) throw new Error(updateError.message);
    if (!cancelled) throw new Error("El estado del envío cambió. Actualiza la página y vuelve a intentarlo.");

    const eventMessage = data.reason
      ? `Cancelado por un administrador: ${data.reason}`
      : "Cancelado por un administrador";

    await supabaseAdmin.from("transfer_events").insert({
      transfer_id: t.id,
      status: "cancelled",
      message: eventMessage,
    });

    await supabaseAdmin.from("notifications").insert({
      user_id: t.user_id,
      title: `Envío cancelado · ${t.reference}`,
      body: data.reason ?? "Tu envío fue cancelado por un administrador.",
    });

    return { ok: true, message: "Envío cancelado", status: "cancelled" };
  });

/** Finaliza el envío pagando automáticamente al MonCash/NatCash del destinatario vía Bazik. */
export const finalizeTransferPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof finalizeSchema>) => finalizeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: t, error } = await context.supabase
      .from("transfers")
      .select(
        "id, user_id, status, reference, recipient_name, recipient_phone, delivery_method, amount_htg",
      )
      .eq("id", data.transferId)
      .maybeSingle();

    if (error || !t) throw new Error("Envío no encontrado");
    if (t.user_id !== context.userId) throw new Error("No autorizado");
    if (t.status === "completed") throw new Error("Este envío ya fue completado");
    if (t.status === "cancelled") throw new Error("Este envío fue cancelado");
    if (t.status === "processing") throw new Error("Este envío ya se está procesando");
    if (t.status !== "paid") {
      throw new Error("Este envío aún no tiene el pago confirmado");
    }
    if (t.delivery_method !== "moncash" && t.delivery_method !== "natcash") {
      throw new Error("Este método de entrega no se puede finalizar automáticamente");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: claimed, error: claimError } = await supabaseAdmin.rpc("claim_bazik_payout", {
      _transfer_id: t.id,
      _from_status: "paid",
    });
    if (claimError || !claimed) {
      throw new Error("Este envío ya está siendo procesado o ya fue enviado a Bazik.");
    }

    const { bazikPayout } = await import("@/lib/bazik.server");
    const result = await bazikPayout({
      provider: t.delivery_method,
      phone: t.recipient_phone,
      amount: Number(t.amount_htg),
      currency: "HTG",
      reference: t.reference,
      recipientName: t.recipient_name,
    });

    if (!result.ok) {
      await supabaseAdmin
        .from("transfers")
        .update({
          bazik_status: result.retryable === false ? "unknown" : "failed",
          bazik_error: result.error,
          ...(result.retryable === false ? {} : { status: "paid" }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .eq("id", t.id);
      throw new Error(result.error);
    }

    await supabaseAdmin
      .from("transfers")
      .update({
        bazik_status: result.status ?? "pending",
        ...(result.providerReference ? { bazik_transaction_id: result.providerReference } : {}),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .eq("id", t.id);

    return {
      ok: true,
      provider: t.delivery_method,
      phone: t.recipient_phone,
      status: "processing",
      ...(result.providerReference ? { providerReference: result.providerReference } : {}),
    };
  });

/** Admin confirma una transacción manualmente llamando a Bazik si es MonCash/NatCash. */
export const adminConfirmTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof adminConfirmSchema>) => adminConfirmSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { verifyIsAdmin } = await import("@/lib/admin.server");
    const isAdminData = await verifyIsAdmin(context);
    if (!isAdminData) throw new Error("No autorizado");

    const { data: t, error } = await context.supabase
      .from("transfers")
      .select(
        "id, status, reference, recipient_name, recipient_phone, delivery_method, amount_htg",
      )
      .eq("id", data.transferId)
      .maybeSingle();

    if (error || !t) throw new Error("Envío no encontrado");
    if (t.status === "completed") throw new Error("Este envío ya fue completado");
    if (t.status === "cancelled") throw new Error("Este envío fue cancelado");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const usesBazikPayout = t.delivery_method === "moncash" || t.delivery_method === "natcash";

    // Nunca marcar como completado un payout de Bazik solo porque ya está en processing.
    // El estado final debe venir del webhook autenticado del proveedor.
    if (usesBazikPayout && t.status === "processing") {
      return {
        ok: true,
        message: "El envío ya fue enviado a Bazik y espera confirmación del proveedor.",
        status: "processing",
      };
    }

    if (usesBazikPayout && t.status !== "paid") {
      throw new Error("El pago de entrada debe estar confirmado antes de iniciar el payout de Bazik.");
    }

    // Bazik payout: el envío permanece en processing hasta recibir un webhook válido.
    if (usesBazikPayout) {
      const { data: claimed, error: claimError } = await supabaseAdmin.rpc("claim_bazik_payout", {
        _transfer_id: t.id,
        _from_status: "paid",
      });
      if (claimError || !claimed) {
        throw new Error("Este envío ya está siendo procesado o ya fue enviado a Bazik.");
      }

      const { bazikPayout } = await import("@/lib/bazik.server");
      const result = await bazikPayout({
        provider: t.delivery_method,
        phone: t.recipient_phone,
        amount: Number(t.amount_htg),
        currency: "HTG",
        reference: t.reference,
        recipientName: t.recipient_name,
      });

      if (!result.ok) {
        await supabaseAdmin
          .from("transfers")
          .update({
            bazik_status: result.retryable === false ? "unknown" : "failed",
            bazik_error: result.error,
            ...(result.retryable === false ? {} : { status: "paid" }),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any)
          .eq("id", t.id);
        throw new Error(result.error);
      }

      await supabaseAdmin
        .from("transfers")
        .update({
          bazik_status: result.status ?? "pending",
          ...(result.providerReference ? { bazik_transaction_id: result.providerReference } : {}),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .eq("id", t.id);

      return {
        ok: true,
        message: "Enviado a Bazik. Esperando confirmación...",
        status: "processing",
      };
    }

    // Para métodos gestionados manualmente, solo se permite completar después de
    // confirmar que el pago de entrada está registrado. Nunca completar desde created
    // o awaiting_payment.
    if (t.status !== "paid") {
      throw new Error("El envío debe tener el pago confirmado antes de marcarlo como completado.");
    }

    const { error: completeError } = await supabaseAdmin
      .from("transfers")
      .update({ status: "completed" })
      .eq("id", t.id)
      .eq("status", "paid");
    if (completeError) throw new Error("No se pudo completar el envío.");
    
    return {
      ok: true,
      message: "Transacción confirmada",
      status: "completed",
    };
  });
