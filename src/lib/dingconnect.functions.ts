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
