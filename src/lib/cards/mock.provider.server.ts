// Proveedor simulado (sandbox interno).
// NO genera PAN, CVV ni BIN reales: sólo metadatos de prueba con marca
// "simulated" para poder probar todo el flujo antes de tener emisor real.

import type {
  CardProvider,
  CardholderInput,
  CreateCardInput,
  ProviderCard,
  ProviderCardLimits,
  ProviderCardholder,
  ProviderTransaction,
} from "./card-provider.interface";

const store = new Map<string, ProviderCard>();

function pseudoLast4(seed: string) {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) % 10000;
  return String(hash).padStart(4, "0");
}

export const mockCardProvider: CardProvider = {
  name: "mock",
  live: false,

  async createCardholder(input: CardholderInput): Promise<ProviderCardholder> {
    return { providerCardholderId: `mock_ch_${input.userId.slice(0, 12)}`, status: "active" };
  },

  async createVirtualCard(input: CreateCardInput): Promise<ProviderCard> {
    const existing = store.get(input.idempotencyKey);
    if (existing) return existing;
    const now = new Date();
    const card: ProviderCard = {
      providerCardId: `mock_card_${input.idempotencyKey}`,
      brand: input.brand,
      last4: pseudoLast4(input.idempotencyKey),
      expMonth: now.getMonth() + 1,
      expYear: now.getFullYear() + 3,
      status: "active",
      currency: input.currency,
      simulated: true,
    };
    store.set(input.idempotencyKey, card);
    store.set(card.providerCardId, card);
    return card;
  },

  async getCard(cardId: string): Promise<ProviderCard> {
    const card = store.get(cardId);
    if (!card) {
      return {
        providerCardId: cardId,
        brand: "visa",
        last4: pseudoLast4(cardId),
        expMonth: 12,
        expYear: new Date().getFullYear() + 3,
        status: "active",
        currency: "USD",
        simulated: true,
      };
    }
    return card;
  },

  async freezeCard(cardId: string) {
    const card = store.get(cardId);
    if (card) store.set(cardId, { ...card, status: "frozen" });
  },

  async unfreezeCard(cardId: string) {
    const card = store.get(cardId);
    if (card) store.set(cardId, { ...card, status: "active" });
  },

  async terminateCard(cardId: string) {
    const card = store.get(cardId);
    if (card) store.set(cardId, { ...card, status: "cancelled" });
  },

  async getCardTransactions(): Promise<ProviderTransaction[]> {
    // El histórico real vive en la base de datos de Lajan Rapid (webhooks).
    return [];
  },

  async updateCardLimits(_cardId: string, _limits: ProviderCardLimits) {
    // El proveedor simulado acepta cualquier límite; se aplican en la base de datos.
  },
};
