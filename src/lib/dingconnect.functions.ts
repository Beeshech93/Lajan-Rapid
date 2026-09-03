import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  parseDingCredentialsInput,
  parseDingProductsInput,
  parseDingTopupInput,
  type DingCredentialsInput,
  type DingProductsInput,
  type DingTopupInput,
} from "@/lib/dingconnect.schemas";

/** Catálogo de operadores y montos disponibles por país. */
export const dingListProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: DingProductsInput) => parseDingProductsInput(input))
  .handler(async ({ data }) => {
    const { dingProducts } = await import("@/lib/dingconnect.server");
    try {
      return { ok: true as const, items: await dingProducts(data.countryCode) };
    } catch (e) {
      return { ok: false as const, items: [], error: (e as Error).message };
    }
  });

/** Envía una recarga de saldo móvil descontando el monto de la billetera. */
export const dingSendTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: DingTopupInput) => parseDingTopupInput(input))
  .handler(async ({ data, context }) => {
    const { data: topup, error } = await context.supabase.rpc("create_topup", {
      _wallet_id: data.walletId,
      _sku_code: data.skuCode,
      _operator: data.operator ?? "",
      _country_code: data.countryCode ?? "",
      _phone: data.phone,
      _amount: data.amount,
    });
    if (error || !topup) throw new Error(error?.message ?? "No se pudo crear la recarga");

    const row = topup as unknown as {
      id: string;
      reference: string;
      currency: string;
    };

    const { dingSendTransfer, applyDingResult } = await import("@/lib/dingconnect.server");
    try {
      const res = await dingSendTransfer({
        skuCode: data.skuCode,
        sendValue: data.amount,
        sendCurrency: row.currency,
        accountNumber: data.phone,
        distributorRef: row.reference,
      });
      await applyDingResult({
        reference: row.reference,
        state: res.processingState,
        providerRef: res.providerRef,
      });
      return { ok: true as const, reference: row.reference, status: res.processingState };
    } catch (e) {
      await applyDingResult({
        reference: row.reference,
        state: "failed",
        detail: (e as Error).message,
      });
      throw new Error((e as Error).message);
    }
  });

const TOPUP_CARD_METHODS = ["card", "tarjeta", "mercado_pago", "mercadopago"];

/**
 * Crea una recarga pendiente pagada con un proveedor externo (tarjeta vía
 * Mercado Pago/Stripe, o OXXO/SPEI en México) en vez de la billetera interna.
 * El envío real a DingConnect se dispara cuando el webhook del proveedor
 * confirma el pago (ver applyExternalTopupPayment en dingconnect.server.ts).
 */
export const dingCreateTopupCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      skuCode: string;
      operator?: string;
      countryCode?: string;
      phone: string;
      amount: number;
      currency: string;
      paymentMethod: string;
      originCountry: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.rpc("create_topup_pending", {
      _sku_code: data.skuCode,
      _operator: data.operator ?? "",
      _country_code: data.countryCode ?? "",
      _phone: data.phone,
      _amount: data.amount,
      _currency: data.currency,
      _payment_method: data.paymentMethod,
      _origin_country: data.originCountry,
    });
    if (error || !row) throw new Error(error?.message ?? "No se pudo crear la recarga");

    const topup = row as unknown as { id: string; reference: string; currency: string };
    const email = context.claims?.email as string | undefined;
    const base = process.env["PUBLIC_URL"] || "https://lajanrapid.app";
    const description = `Recarga ${data.phone} · ${data.operator ?? ""}`;

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();
    const [firstNameRaw, ...rest] = (profile?.full_name || "Cliente Lajan").split(" ");
    const firstName = firstNameRaw || "Cliente";
    const lastName = rest.join(" ") || "Rapid";

    if (data.originCountry === "MX") {
      if (data.paymentMethod === "oxxo") {
        if (!email) throw new Error("Necesitamos un correo en tu cuenta para emitir la ficha");
        const { createOxxoVoucher } = await import("@/lib/mercadopago.server");
        const result = await createOxxoVoucher({
          reference: topup.reference,
          amount: data.amount,
          description,
          payerEmail: email,
          payerFirstName: firstName,
          payerLastName: lastName,
        });
        if (!result.ok) throw new Error(result.error);
        return { mode: "voucher" as const, voucher: result.voucher, reference: topup.reference };
      }

      if (data.paymentMethod === "spei") {
        if (!email) throw new Error("Necesitamos un correo en tu cuenta para emitir la CLABE");
        const { createSpeiReference } = await import("@/lib/mercadopago.server");
        const result = await createSpeiReference({
          reference: topup.reference,
          amount: data.amount,
          description,
          payerEmail: email,
          payerFirstName: firstName,
          payerLastName: lastName,
        });
        if (!result.ok) throw new Error(result.error);
        return { mode: "spei" as const, spei: result.spei, reference: topup.reference };
      }

      // Tarjeta en México vía Mercado Pago.
      const { createMpPreference } = await import("@/lib/mercadopago.server");
      const result = await createMpPreference({
        transferId: topup.id,
        reference: topup.reference,
        amount: data.amount,
        currency: topup.currency,
        description,
        ...(email ? { buyerEmail: email } : {}),
        cardOnly: true,
        successUrl: `${base}/recargas?payment=success`,
        pendingUrl: `${base}/recargas?payment=pending`,
        failureUrl: `${base}/recargas?payment=failure`,
      });
      if (!result.ok) throw new Error(result.error);
      return {
        mode: "checkout" as const,
        checkoutUrl: result.checkoutUrl,
        reference: topup.reference,
      };
    }

    // Tarjeta fuera de México vía Stripe.
    if (!TOPUP_CARD_METHODS.includes(data.paymentMethod)) {
      throw new Error("Este método de pago no está disponible fuera de México");
    }
    const { createStripeCheckoutSession } = await import("@/lib/stripe.server");
    const result = await createStripeCheckoutSession({
      transferId: topup.id,
      reference: topup.reference,
      amount: data.amount,
      currency: topup.currency,
      description,
      ...(email ? { buyerEmail: email } : {}),
      successUrl: `${base}/recargas?payment=success`,
      cancelUrl: `${base}/recargas?payment=failure`,
    });
    if (!result.ok) throw new Error(result.error);
    return {
      mode: "checkout" as const,
      checkoutUrl: result.checkoutUrl,
      reference: topup.reference,
    };
  });

/** Estado de configuración de DingConnect (solo administradores). */
export const dingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("No autorizado");
    const { dingStatusInfo } = await import("@/lib/dingconnect.server");
    return dingStatusInfo();
  });

/** Guardar manualmente las credenciales de DingConnect (solo administradores). */
export const dingSaveCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: DingCredentialsInput) => parseDingCredentialsInput(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("No autorizado");
    const { saveDingCred } = await import("@/lib/dingconnect.server");
    for (const [name, value] of Object.entries(data)) {
      if (value === undefined) continue;
      await saveDingCred(name, value.trim(), context.userId);
    }
    return { ok: true };
  });
