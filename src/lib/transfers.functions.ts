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
    const { data: isAdminData } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdminData) throw new Error("No autorizado");

    const { data: t, error } = await context.supabase
      .from("transfers")
      .select("id, user_id, status, reference")
      .eq("id", data.transferId)
      .maybeSingle();

    if (error || !t) throw new Error("Envío no encontrado");
    if (t.status === data.status) {
      return { ok: true, message: "Ya estaba en esa etapa", status: data.status };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: updateError } = await supabaseAdmin
      .from("transfers")
      .update({ status: data.status })
      .eq("id", t.id);
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
    const { data: isAdminData } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdminData) throw new Error("No autorizado");

    const { data: t, error } = await context.supabase
      .from("transfers")
      .select("id, user_id, status, reference")
      .eq("id", data.transferId)
      .maybeSingle();

    if (error || !t) throw new Error("Envío no encontrado");
    if (t.status === "completed") throw new Error("No se puede cancelar un envío ya entregado");
    if (t.status === "cancelled") {
      return { ok: true, message: "Ya estaba cancelado", status: "cancelled" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: updateError } = await supabaseAdmin
      .from("transfers")
      .update({ status: "cancelled" })
      .eq("id", t.id);
    if (updateError) throw new Error(updateError.message);

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
        "id, user_id, status, reference, recipient_name, recipient_phone, delivery_method, amount_receive, receive_currency",
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

    const { bazikPayout } = await import("@/lib/bazik.server");
    const result = await bazikPayout({
      provider: t.delivery_method,
      phone: t.recipient_phone,
      amount: Number(t.amount_receive),
      currency: t.receive_currency,
      reference: t.reference,
      recipientName: t.recipient_name,
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("transfers").update({ status: "processing" }).eq("id", t.id);

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
    // Verificar que es admin
    const { data: isAdminData } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });

    if (!isAdminData) throw new Error("No autorizado");

    const { data: t, error } = await context.supabase
      .from("transfers")
      .select(
        "id, status, reference, recipient_name, recipient_phone, delivery_method, amount_receive, receive_currency",
      )
      .eq("id", data.transferId)
      .maybeSingle();

    if (error || !t) throw new Error("Envío no encontrado");
    if (t.status === "completed") throw new Error("Este envío ya fue completado");
    if (t.status === "cancelled") throw new Error("Este envío fue cancelado");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Si es MonCash/NatCash, llamar a Bazik (solo MonCash está soportado por su API).
    if (
      (t.delivery_method === "moncash" || t.delivery_method === "natcash") &&
      t.status === "awaiting_payment"
    ) {
      const { bazikPayout } = await import("@/lib/bazik.server");
      const result = await bazikPayout({
        provider: t.delivery_method,
        phone: t.recipient_phone,
        amount: Number(t.amount_receive),
        currency: t.receive_currency,
        reference: t.reference,
        recipientName: t.recipient_name,
      });

      if (!result.ok) {
        throw new Error(result.error);
      }

      // Marcar como processing (esperar callback del webhook)
      await supabaseAdmin.from("transfers").update({ status: "processing" }).eq("id", t.id);

      return {
        ok: true,
        message: "Enviado a Bazik. Esperando confirmación...",
        status: "processing",
      };
    }

    // Si no es MonCash/NatCash o ya está en processing, marcar directo como completed
    await supabaseAdmin.from("transfers").update({ status: "completed" }).eq("id", t.id);

    return {
      ok: true,
      message: "Transacción confirmada",
      status: "completed",
    };
  });
