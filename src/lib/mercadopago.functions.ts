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
    const { verifyIsAdmin } = await import("@/lib/admin.server");
    if (!(await verifyIsAdmin(context))) throw new Error("No autorizado");
    const { mpStatusInfo } = await import("@/lib/mercadopago.server");
    return mpStatusInfo();
  });

/** Guardar manualmente las credenciales de Mercado Pago (solo administradores). */
export const mercadoPagoSaveCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: MpCredentialsInput) => parseMpCredentialsInput(input))
  .handler(async ({ data, context }) => {
    const { verifyIsAdmin } = await import("@/lib/admin.server");
    if (!(await verifyIsAdmin(context))) throw new Error("No autorizado");
    const { saveMpCred } = await import("@/lib/mercadopago.server");
    for (const [name, value] of Object.entries(data)) {
      if (value === undefined) continue;
      await saveMpCred(name, value.trim(), context.userId, context.supabase);
    }
    return { ok: true };
  });

const CARD_METHODS = ["mercado_pago", "mercadopago", "card", "tarjeta"];

async function getAuthorizedTransfer(
  transferId: string,
  context: { supabase: any; userId: string; claims?: any },
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { verifyIsAdmin } = await import("@/lib/admin.server");
  const isAdmin = await verifyIsAdmin(context);

  let t: any = null;

  // 1. Intentar con context.supabase
  try {
    const { data: tClient } = await context.supabase
      .from("transfers")
      .select("*")
      .eq("id", transferId)
      .maybeSingle();
    if (tClient && (tClient.user_id === context.userId || isAdmin)) {
      t = tClient;
    }
  } catch {}

  // 2. Si no se encontró (o RLS en el servidor no devolvió la fila), buscar con supabaseAdmin
  if (!t) {
    try {
      const { data: tAdmin } = await supabaseAdmin
        .from("transfers")
        .select("*")
        .eq("id", transferId)
        .maybeSingle();
      if (tAdmin && (tAdmin.user_id === context.userId || isAdmin)) {
        t = tAdmin;
      }
    } catch {}
  }

  if (t) {
    // Si la transferencia tenía tasa 0 o monto a recibir en 0, repararla
    if (Number(t.rate) <= 0 || Number(t.amount_receive) <= 0) {
      const fixedRate = 7.20;
      const fixedReceive =
        Math.round(Number(t.amount_send || t.total_send) * fixedRate * 100) / 100;
      t.rate = fixedRate;
      t.amount_receive = fixedReceive;
      try {
        await supabaseAdmin
          .from("transfers")
          .update({ rate: fixedRate, amount_receive: fixedReceive })
          .eq("id", t.id);
      } catch {}
    }
  }

  return t;
}

/** Inicia el pago en Mercado Pago y retorna la URL de checkout. */
export const mercadoPagoInitiatePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { transferId: string }) => input)
  .handler(async ({ data, context }) => {
    const transfer = await getAuthorizedTransfer(data.transferId, context);

    if (!transfer) {
      throw new Error("Transferencia no encontrada");
    }

    if (!CARD_METHODS.includes(transfer.payment_method)) {
      throw new Error("Este método de pago no usa Mercado Pago");
    }

    const email =
      (context.claims?.email as string | undefined) ||
      (context.claims?.user_metadata?.email as string | undefined) ||
      "cliente@lajanrapid.com";
    const base = process.env["PUBLIC_URL"] || "https://lajanrapid.app";

    const { createMpPreference } = await import("@/lib/mercadopago.server");
    const result = await createMpPreference({
      transferId: transfer.id,
      reference: transfer.reference,
      amount: Number(transfer.total_send),
      currency: transfer.send_currency,
      description: `Envío ${transfer.reference} a ${transfer.recipient_name}`,
      payerEmail: email,
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
    const transfer = await getAuthorizedTransfer(data.transferId, context);

    if (!transfer) throw new Error("Transferencia no encontrada");
    if (transfer.payment_method !== "spei") throw new Error("Este envío no se paga por SPEI");
    if (transfer.status !== "awaiting_payment" && transfer.status !== "created") {
      throw new Error("Este envío ya no está pendiente de pago");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", transfer.user_id)
      .maybeSingle();
    const [firstName, ...rest] = (profile?.full_name || "Cliente Lajan").split(" ");

    const email =
      (context.claims?.email as string | undefined) ||
      (context.claims?.user_metadata?.email as string | undefined) ||
      "cliente@lajanrapid.com";

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
    const transfer = await getAuthorizedTransfer(data.transferId, context);

    if (!transfer) throw new Error("Transferencia no encontrada");
    if (transfer.payment_method !== "oxxo") throw new Error("Este envío no se paga en OXXO");
    if (transfer.status !== "awaiting_payment" && transfer.status !== "created") {
      throw new Error("Este envío ya no está pendiente de pago");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", transfer.user_id)
      .maybeSingle();
    const [firstName, ...rest] = (profile?.full_name || "Cliente Lajan").split(" ");

    const email =
      (context.claims?.email as string | undefined) ||
      (context.claims?.user_metadata?.email as string | undefined) ||
      "cliente@lajanrapid.com";

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
