import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  parseCardActionInput,
  parseCardIssuerCredentials,
  parseCardProgramConfig,
  parseIssueCardInput,
  parseRevealCardInput,
  type CardActionInput,
  type CardIssuerCredentialsInput,
  type CardProgramConfigInput,
  type IssueCardInput,
  type RevealCardRequest,
} from "@/lib/cards.schemas";

/** Estado de conexión con el emisor de tarjetas (solo administradores). */
export const cardIssuerStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("No autorizado");
    const { cardIssuerStatusInfo } = await import("@/lib/cards.server");
    const { cardProgramStatus } = await import("@/lib/cards/registry.server");
    const [issuer, program] = await Promise.all([cardIssuerStatusInfo(), cardProgramStatus()]);
    return { ...issuer, program };
  });

/** Guardar manualmente las credenciales del emisor (solo administradores). */
export const cardIssuerSaveCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CardIssuerCredentialsInput) => parseCardIssuerCredentials(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("No autorizado");
    const { saveCardCred } = await import("@/lib/cards.server");
    for (const [name, value] of Object.entries(data)) {
      if (value === undefined) continue;
      await saveCardCred(name, value.trim(), context.userId);
    }
    return { ok: true };
  });

/** Configuración del programa de tarjetas: proveedor activo y credenciales de red. */
export const cardSaveProgramConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CardProgramConfigInput) => parseCardProgramConfig(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("No autorizado");
    const { saveCardConfig, cardProgramStatus } = await import("@/lib/cards/registry.server");
    for (const [name, value] of Object.entries(data)) {
      if (value === undefined) continue;
      await saveCardConfig(name, String(value).trim(), context.userId);
    }
    return cardProgramStatus();
  });

/**
 * Emisión de tarjeta virtual: KYC aprobado → proveedor configurado →
 * tarjeta guardada con metadatos seguros (sin PAN ni CVV).
 */
export const issueCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: IssueCardInput) => parseIssueCardInput(input))
  .handler(async ({ data, context }) => {
    const { KycRequiredError, CardCreationError } = await import("@/lib/cards/errors");
    const { getCardProvider } = await import("@/lib/cards/registry.server");

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("kyc_status, full_name, country")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile || profile.kyc_status !== "approved") throw new KycRequiredError();

    const { data: wallet } = await context.supabase
      .from("wallets")
      .select("id, currency, user_id")
      .eq("id", data.walletId)
      .maybeSingle();
    if (!wallet || wallet.user_id !== context.userId) throw new CardCreationError("Billetera inválida");

    const provider = await getCardProvider();
    const [firstName, ...rest] = (profile.full_name || "Cliente Lajan").split(" ");
    const cardholder = await provider.createCardholder({
      userId: context.userId,
      firstName: firstName ?? "Cliente",
      lastName: rest.join(" ") || "Lajan",
      country: profile.country ?? "HT",
    });

    const idempotencyKey = `LR-CARD-${context.userId.slice(0, 8)}-${new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "")}-${data.walletId.slice(0, 6)}${data.disposable ? "-D" : ""}`;

    const providerCard = await provider.createVirtualCard({
      cardholderId: cardholder.providerCardholderId,
      brand: data.brand,
      currency: wallet.currency,
      disposable: data.disposable,
      idempotencyKey,
      ...(data.label ? { label: data.label } : {}),
    });

    const { data: cardId, error } = await context.supabase.rpc("issue_virtual_card", {
      _wallet_id: data.walletId,
      _brand: data.brand,
      _disposable: data.disposable,
      ...(data.label ? { _label: data.label } : {}),
    });
    if (error || !cardId) throw new CardCreationError(error?.message ?? "No se pudo emitir");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("virtual_cards")
      .update({
        provider: provider.name,
        provider_card_id: providerCard.providerCardId,
        last4: providerCard.last4,
        exp_month: providerCard.expMonth,
        exp_year: providerCard.expYear,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cardId as string);

    return {
      ok: true,
      cardId: cardId as string,
      provider: provider.name,
      simulated: providerCard.simulated,
      last4: providerCard.last4,
    };
  });

/** Controles de tarjeta: congelar, desbloquear o terminar. */
export const setCardControl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CardActionInput) => parseCardActionInput(input))
  .handler(async ({ data, context }) => {
    const { CardNotFoundError } = await import("@/lib/cards/errors");
    const { getCardProvider } = await import("@/lib/cards/registry.server");

    const { data: card } = await context.supabase
      .from("virtual_cards")
      .select("id, user_id, provider_card_id, status")
      .eq("id", data.cardId)
      .maybeSingle();
    if (!card || card.user_id !== context.userId) throw new CardNotFoundError();

    const provider = await getCardProvider();
    if (card.provider_card_id) {
      if (data.action === "freeze") await provider.freezeCard(card.provider_card_id);
      if (data.action === "unfreeze") await provider.unfreezeCard(card.provider_card_id);
      if (data.action === "terminate") await provider.terminateCard(card.provider_card_id);
    }

    const status =
      data.action === "freeze" ? "frozen" : data.action === "unfreeze" ? "active" : "cancelled";
    const { error } = await context.supabase.rpc("set_card_status", {
      _card_id: data.cardId,
      _status: status,
    });
    if (error) throw new Error(error.message);
    return { ok: true, status };
  });

/** Datos completos de la tarjeta, pedidos al emisor solo para su dueño. */
export const revealCardDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: RevealCardRequest) => parseRevealCardInput(input))
  .handler(async ({ data, context }) => {
    const { data: card, error } = await context.supabase
      .from("virtual_cards")
      .select("id, user_id, provider_card_id, status")
      .eq("id", data.cardId)
      .maybeSingle();

    if (error || !card || card.user_id !== context.userId) {
      throw new Error("Tarjeta no encontrada");
    }
    if (!card.provider_card_id) {
      return {
        ok: false,
        configured: false,
        error: "Esta tarjeta aún no está vinculada al emisor.",
      };
    }

    const { fetchCardSecureDetails } = await import("@/lib/cards.server");
    return fetchCardSecureDetails(card.provider_card_id);
  });
