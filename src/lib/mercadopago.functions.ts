import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  parseMpCredentialsInput,
  parseOxxoVoucherInput,
  parseSpeiReferenceInput,
  type MpCredentialsInput,
} from "@/lib/mercadopago.schemas";

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

const CARD_METHODS = ["mercado_pago", "mercadopago", "card", "tarjeta"];

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

    if (!CARD_METHODS.includes(transfer.payment_method)) {
      throw new Error("Este método de pago no usa Mercado Pago");
    }

    const email = context.claims?.email as string | undefined;
    const base = process.env["PUBLIC_URL"] || "https://lajanrapid.app";

    const { createMpPreference } = await import("@/lib/mercadopago.server");
    const result = await createMpPreference({
      transferId: transfer.id,
      reference: transfer.reference,
      amount: Number(transfer.total_send),
      currency: transfer.send_currency,
      description: `Envío ${transfer.reference} a ${transfer.recipient_name}`,
      ...(email ? { buyerEmail: email } : {}),
      cardOnly: transfer.payment_method === "card" || transfer.payment_method === "tarjeta",
      successUrl: `${base}/transferencia/${transfer.id}?payment=success`,
      pendingUrl: `${base}/transferencia/${transfer.id}?payment=pending`,
      failureUrl: `${base}/transferencia/${transfer.id}?payment=failure`,
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    return { checkoutUrl: result.checkoutUrl };
  });

/** Genera (o recupera) una CLABE SPEI real para un envío propio. */
export const mercadoPagoSpeiReference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { transferId: string }) => parseSpeiReferenceInput(input))
  .handler(async ({ data, context }) => {
    const { data: transfer } = await context.supabase
      .from("transfers")
      .select("id, reference, total_send, send_currency, payment_method, status, recipient_name")
      .eq("id", data.transferId)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!transfer) throw new Error("Transferencia no encontrada");
    if (transfer.payment_method !== "spei") throw new Error("Este envío no se paga por SPEI");
    if (transfer.status !== "awaiting_payment" && transfer.status !== "created") {
      throw new Error("Este envío ya no está pendiente de pago");
    }

    const email = context.claims?.email as string | undefined;
    if (!email) throw new Error("Necesitamos un correo en tu cuenta para emitir la CLABE");

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();
    const [firstName, ...rest] = (profile?.full_name || "Cliente Lajan").split(" ");

    const { createSpeiReference } = await import("@/lib/mercadopago.server");
    const result = await createSpeiReference({
      reference: transfer.reference,
      amount: Number(transfer.total_send),
      description: `Envío ${transfer.reference} a ${transfer.recipient_name}`,
      payerEmail: email,
      payerFirstName: firstName || "Cliente",
      payerLastName: rest.join(" ") || "Lajan",
    });

    if (!result.ok) throw new Error(result.error);
    return result.spei;
  });

/** Genera (o recupera) la ficha real de pago en OXXO para un envío propio. */
export const mercadoPagoOxxoVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { transferId: string }) => parseOxxoVoucherInput(input))
  .handler(async ({ data, context }) => {
    const { data: transfer } = await context.supabase
      .from("transfers")
      .select("id, reference, total_send, send_currency, payment_method, status, recipient_name")
      .eq("id", data.transferId)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!transfer) throw new Error("Transferencia no encontrada");
    if (transfer.payment_method !== "oxxo") throw new Error("Este envío no se paga en OXXO");
    if (transfer.status !== "awaiting_payment" && transfer.status !== "created") {
      throw new Error("Este envío ya no está pendiente de pago");
    }

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();
    const [firstName, ...rest] = (profile?.full_name || "Cliente Lajan").split(" ");

    const email = context.claims?.email as string | undefined;
    if (!email) throw new Error("Necesitamos un correo en tu cuenta para emitir la ficha");

    const { createOxxoVoucher } = await import("@/lib/mercadopago.server");
    const result = await createOxxoVoucher({
      reference: transfer.reference,
      amount: Number(transfer.total_send),
      description: `Envío ${transfer.reference} a ${transfer.recipient_name}`,
      payerEmail: email,
      payerFirstName: firstName || "Cliente",
      payerLastName: rest.join(" ") || "Lajan",
    });

    if (!result.ok) throw new Error(result.error);
    return result.voucher;
  });
