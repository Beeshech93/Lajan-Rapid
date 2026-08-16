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

/** Inicia el pago en Mercado Pago y retorna la URL de checkout. */
export const mercadoPagoInitiatePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { transferId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    
    // Obtener la transferencia
    const { data: transfer, error } = await supabase
      .from("transfers")
      .select("*")
      .eq("id", data.transferId)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (error || !transfer) {
      throw new Error("Transferencia no encontrada");
    }

    if (transfer.payment_method !== "mercadopago" && transfer.payment_method !== "tarjeta") {
      throw new Error("Este método de pago no usa Mercado Pago");
    }

    const { createMpPreference } = await import("@/lib/mercadopago.server");
    const checkoutUrl = await createMpPreference({
      transferId: transfer.id,
      reference: transfer.reference,
      amount: Number(transfer.total_send),
      currency: transfer.send_currency,
      description: `Envío ${transfer.reference} a ${transfer.recipient_name}`,
      ...(( await supabase.auth.getUser()).data.user?.email ? { buyerEmail: (await supabase.auth.getUser()).data.user!.email as string } : {}),
      successUrl: `${process.env['PUBLIC_URL'] || "http://localhost:5173"}/transferencia/${transfer.id}?payment=success`,
      pendingUrl: `${process.env['PUBLIC_URL'] || "http://localhost:5173"}/transferencia/${transfer.id}?payment=pending`,
      failureUrl: `${process.env['PUBLIC_URL'] || "http://localhost:5173"}/transferencia/${transfer.id}?payment=failure`,
    });

    if (!checkoutUrl) {
      throw new Error("No se pudo crear la preferencia de pago");
    }

    return { checkoutUrl };
  });
