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
    const { verifyIsAdmin, verifyIsStaff } = await import("@/lib/admin.server");
    const isAdminData = await verifyIsAdmin(context);
    const isStaffData = await verifyIsStaff(context);
    if (!isAdminData && !isStaffData) throw new Error("No autorizado");

    const { data: t, error } = await context.supabase
      .from("transfers")
      .select("id, user_id, agent_id, status, reference")
      .eq("id", data.transferId)
      .maybeSingle();

    if (error || !t) throw new Error("Envío no encontrado");
    if (!isAdminData && t.agent_id !== context.userId && t.user_id !== context.userId) {
      throw new Error("Solo puedes modificar envíos gestionados por tu agencia");
    }
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
    const { verifyIsAdmin } = await import("@/lib/admin.server");
    const isAdminData = await verifyIsAdmin(context);
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
      amount: Number(t.amount_receive),
      currency: t.receive_currency,
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

/** Confirma una transacción manualmente llamando a Bazik si es MonCash/NatCash. Autorizado para Admin y Agentes. */
export const adminConfirmTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof adminConfirmSchema>) => adminConfirmSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { verifyIsAdmin, verifyIsStaff } = await import("@/lib/admin.server");
    const isAdminData = await verifyIsAdmin(context);
    const isStaffData = await verifyIsStaff(context);
    if (!isAdminData && !isStaffData) throw new Error("No autorizado");

    const { data: t, error } = await context.supabase
      .from("transfers")
      .select(
        "id, status, reference, recipient_name, recipient_phone, delivery_method, amount_receive, receive_currency, agent_id, payment_method, total_send, send_currency",
      )
      .eq("id", data.transferId)
      .maybeSingle();

    if (error || !t) throw new Error("Envío no encontrado");
    if (t.status === "completed") throw new Error("Este envío ya fue completado");
    if (t.status === "cancelled") throw new Error("Este envío fue cancelado");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Si un agente confirma la transferencia y no tenía agente asignado, asignarlo a este agente
    if (!isAdminData && !t.agent_id) {
      await supabaseAdmin
        .from("transfers")
        .update({ agent_id: context.userId })
        .eq("id", t.id);
    }

    // Si es MonCash/NatCash, llamar a Bazik (solo MonCash está soportado por su API).
    if (
      (t.delivery_method === "moncash" || t.delivery_method === "natcash") &&
      t.status === "awaiting_payment"
    ) {
      const { data: claimed, error: claimError } = await supabaseAdmin.rpc("claim_bazik_payout", {
        _transfer_id: t.id,
        _from_status: "awaiting_payment",
      });
      if (claimError || !claimed) {
        throw new Error("Este envío ya está siendo procesado o ya fue enviado a Bazik.");
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
        await supabaseAdmin
          .from("transfers")
          .update({
            bazik_status: result.retryable === false ? "unknown" : "failed",
            bazik_error: result.error,
            ...(result.retryable === false ? {} : { status: "awaiting_payment" }),
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

    // Si no es MonCash/NatCash o ya está en processing, marcar directo como completed
    await supabaseAdmin.from("transfers").update({ status: "completed" }).eq("id", t.id);

    return {
      ok: true,
      message: "Transacción confirmada",
      status: "completed",
    };
  });

const agentCreateCashSchema = z.object({
  originCountry: z.string().min(2).max(2).default("DO"),
  destinationCountry: z.string().min(2).max(2).default("HT"),
  recipientName: z.string().min(2).max(100),
  recipientPhone: z.string().min(6).max(25),
  recipientCity: z.string().min(2).max(100),
  deliveryMethod: z.string().min(2).max(50),
  amountSend: z.number().positive(),
  note: z.string().max(300).optional(),
});

/**
 * Permite a un agente independiente registrar y procesar una transferencia en ventanilla.
 * REGLA: Los agentes SOLO reciben efectivo para hacer sus transacciones.
 */
export const agentCreateCashTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof agentCreateCashSchema>) =>
    agentCreateCashSchema.parse(input),
  )
  .handler(async ({ data, context }) => {
    const { verifyIsAdmin, verifyIsStaff } = await import("@/lib/admin.server");
    const isAdminData = await verifyIsAdmin(context);
    const isStaffData = await verifyIsStaff(context);
    if (!isAdminData && !isStaffData) {
      throw new Error("Solo agentes autorizados pueden registrar operaciones en efectivo.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Validar país de origen y destino
    const { data: oc } = await supabaseAdmin
      .from("countries")
      .select("code, currency, name")
      .eq("code", data.originCountry)
      .eq("is_origin", true)
      .single();
    if (!oc) throw new Error("País de origen no válido");

    const { data: dc } = await supabaseAdmin
      .from("countries")
      .select("code, currency, name")
      .eq("code", data.destinationCountry)
      .eq("is_destination", true)
      .single();
    if (!dc) throw new Error("País de destino no válido");

    // Obtener tasa de cambio del corredor
    const { data: exRate } = await supabaseAdmin
      .from("exchange_rates")
      .select("*")
      .eq("from_currency", oc.currency)
      .eq("to_currency", dc.currency)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!exRate) throw new Error("No hay tasa de cambio disponible para este corredor.");

    const rate = Number(exRate.rate);
    const feePercent = Number(exRate.fee_percent);
    const feeFixed = Number(exRate.fee_fixed);
    const agentCommPercent = Number(exRate.agent_commission_percent);

    const feeSend = Math.round((data.amountSend * (feePercent / 100) + feeFixed) * 100) / 100;
    const totalSend = Math.round((data.amountSend + feeSend) * 100) / 100;
    const amountReceive = Math.round(data.amountSend * rate * 100) / 100;
    const agentCommission = Math.round(data.amountSend * (agentCommPercent / 100) * 100) / 100;

    // Validación de límites MonCash / NatCash
    if (data.destinationCountry === "HT" && data.deliveryMethod === "moncash" && amountReceive > 75000) {
      throw new Error("MonCash permite un máximo de 75,000 HTG por transacción.");
    }
    if (data.destinationCountry === "HT" && data.deliveryMethod === "natcash") {
      if (amountReceive < 3998 || amountReceive > 75000) {
        throw new Error("NatCash requiere entre 3,998 y 75,000 HTG por transacción.");
      }
    }

    // Insertar transferencia en efectivo por el agente
    const { data: newTransfer, error: insertError } = await supabaseAdmin
      .from("transfers")
      .insert({
        user_id: context.userId,
        agent_id: context.userId,
        origin_country: data.originCountry,
        destination_country: data.destinationCountry,
        send_currency: oc.currency,
        receive_currency: dc.currency,
        recipient_name: data.recipientName.trim(),
        recipient_phone: data.recipientPhone.trim(),
        recipient_city: data.recipientCity.trim(),
        delivery_method: data.deliveryMethod,
        payment_method: "cash_agent", // EXCLUSIVAMENTE EFECTIVO
        amount_send: data.amountSend,
        fee_send: feeSend,
        total_send: totalSend,
        amount_receive: amountReceive,
        rate: rate,
        agent_commission_send: agentCommission,
        status: "processing", // Cobrado en efectivo en ventanilla por el agente
        note: data.note ? data.note.trim() : null,
      })
      .select("id, reference, status, total_send, send_currency, amount_receive, receive_currency")
      .single();

    if (insertError || !newTransfer) {
      throw new Error(insertError?.message || "No se pudo registrar la transferencia en efectivo.");
    }

    // Registrar evento de auditoría
    await supabaseAdmin.from("transfer_events").insert({
      transfer_id: newTransfer.id,
      status: "processing",
      message: `Pago en efectivo recibido en ventanilla por el agente. Cobrado: ${totalSend} ${oc.currency}. Comisión ganada: ${agentCommission} ${oc.currency}.`,
    });

    // Si es MonCash y Bazik está activo, disparar pago automático al beneficiario
    if (data.deliveryMethod === "moncash" || data.deliveryMethod === "natcash") {
      try {
        const { bazikPayout } = await import("@/lib/bazik.server");
        const payoutRes = await bazikPayout({
          provider: data.deliveryMethod,
          phone: data.recipientPhone.trim(),
          amount: amountReceive,
          currency: dc.currency,
          reference: newTransfer.reference,
          recipientName: data.recipientName.trim(),
        });

        if (payoutRes.ok) {
          await supabaseAdmin
            .from("transfers")
            .update({
              bazik_status: payoutRes.status ?? "pending",
              ...(payoutRes.providerReference ? { bazik_transaction_id: payoutRes.providerReference } : {}),
            } as any)
            .eq("id", newTransfer.id);
        }
      } catch (bazikErr) {
        console.error("Bazik auto-payout error:", bazikErr);
      }
    }

    return {
      ok: true,
      transferId: newTransfer.id,
      reference: newTransfer.reference,
      totalSend,
      currency: oc.currency,
      amountReceive,
      receiveCurrency: dc.currency,
      commission: agentCommission,
    };
  });

const agentConfirmCashSchema = z.object({
  reference: z.string().trim().min(3),
});

/**
 * Permite a un agente cobrar en efectivo una transferencia creada previamente por un cliente.
 */
export const agentConfirmCashPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof agentConfirmCashSchema>) =>
    agentConfirmCashSchema.parse(input),
  )
  .handler(async ({ data, context }) => {
    const { verifyIsAdmin, verifyIsStaff } = await import("@/lib/admin.server");
    const isAdminData = await verifyIsAdmin(context);
    const isStaffData = await verifyIsStaff(context);
    if (!isAdminData && !isStaffData) {
      throw new Error("No autorizado");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: t, error } = await supabaseAdmin
      .from("transfers")
      .select("*")
      .ilike("reference", data.reference.trim())
      .maybeSingle();

    if (error || !t) throw new Error("No se encontró ningún envío con esa referencia.");
    if (t.status === "completed") throw new Error("Este envío ya fue entregado y completado.");
    if (t.status === "cancelled") throw new Error("Este envío fue cancelado.");
    if (t.status !== "awaiting_payment" && t.status !== "created") {
      throw new Error(`Este envío ya tiene estado: ${t.status}`);
    }
    if (t.payment_method !== "cash_agent") {
      throw new Error("Este envío no tiene método de pago en efectivo con agente.");
    }

    // Asignar al agente actual y marcar como processing
    const { error: updErr } = await supabaseAdmin
      .from("transfers")
      .update({
        agent_id: context.userId,
        status: "processing",
      })
      .eq("id", t.id);

    if (updErr) throw new Error(updErr.message);

    await supabaseAdmin.from("transfer_events").insert({
      transfer_id: t.id,
      status: "processing",
      message: `Efectivo recibido en ventanilla por el agente. Cobrado: ${t.total_send} ${t.send_currency}.`,
    });

    await supabaseAdmin.from("notifications").insert({
      user_id: t.user_id,
      title: `Pago en efectivo confirmado · ${t.reference}`,
      body: `El agente ha recibido tu pago en efectivo por ${t.total_send} ${t.send_currency}. Tu envío está en proceso.`,
    });

    // Si es MonCash/NatCash, intentar pago automático
    if (t.delivery_method === "moncash" || t.delivery_method === "natcash") {
      try {
        const { bazikPayout } = await import("@/lib/bazik.server");
        await bazikPayout({
          provider: t.delivery_method,
          phone: t.recipient_phone,
          amount: Number(t.amount_receive),
          currency: t.receive_currency,
          reference: t.reference,
          recipientName: t.recipient_name,
        });
      } catch (err) {
        console.error("Bazik error:", err);
      }
    }

    return {
      ok: true,
      message: `¡Pago de ${t.total_send} ${t.send_currency} recibido exitosamente en efectivo!`,
      transferId: t.id,
    };
  });
