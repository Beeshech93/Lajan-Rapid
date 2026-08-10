import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  parseCardIssuerCredentials,
  parseRevealCardInput,
  type CardIssuerCredentialsInput,
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
    return cardIssuerStatusInfo();
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
