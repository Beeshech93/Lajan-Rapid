import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseStripeCredentialsInput, type StripeCredentialsInput } from "@/lib/stripe.schemas";

/** Estado de configuración de Stripe (solo administradores). */
export const stripeStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("No autorizado");
    const { stripeStatusInfo } = await import("@/lib/stripe.server");
    return stripeStatusInfo();
  });

/** Guardar manualmente las credenciales de Stripe (solo administradores). */
export const stripeSaveCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: StripeCredentialsInput) => parseStripeCredentialsInput(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("No autorizado");
    const { saveStripeCred } = await import("@/lib/stripe.server");
    for (const [name, value] of Object.entries(data)) {
      if (value === undefined) continue;
      await saveStripeCred(name, value.trim(), context.userId);
    }
    return { ok: true };
  });

const CARD_METHODS = ["card", "tarjeta", "mercado_pago", "mercadopago"];

/** Inicia el pago con Stripe (países fuera de México) y retorna la URL de checkout. */
export const stripeInitiatePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { transferId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: transfer, error } = await context.supabase
      .from("transfers")
      .select("*")
      .eq("id", data.transferId)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (error || !transfer) throw new Error("Transferencia no encontrada");
    if (!CARD_METHODS.includes(transfer.payment_method)) {
      throw new Error("Este método de pago no usa tarjeta");
    }
    if (transfer.origin_country === "MX") {
      throw new Error("Los envíos desde México se pagan con Mercado Pago, no con Stripe");
    }

    const email = context.claims?.email as string | undefined;
    const base = process.env["PUBLIC_URL"] || "https://lajanrapid.app";

    const { createStripeCheckoutSession } = await import("@/lib/stripe.server");
    const result = await createStripeCheckoutSession({
      transferId: transfer.id,
      reference: transfer.reference,
      amount: Number(transfer.total_send),
      currency: transfer.send_currency,
      description: `Envío ${transfer.reference} a ${transfer.recipient_name}`,
      ...(email ? { buyerEmail: email } : {}),
      successUrl: `${base}/transferencia/${transfer.id}?payment=success`,
      cancelUrl: `${base}/transferencia/${transfer.id}?payment=failure`,
    });

    if (!result.ok) throw new Error(result.error);
    return { checkoutUrl: result.checkoutUrl };
  });
