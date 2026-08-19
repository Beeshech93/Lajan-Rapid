// Contrato independiente del proveedor de tarjetas.
// Cambiar de Visa a Mastercard (o a otro emisor) no debe requerir tocar
// el módulo de tarjetas: basta con implementar esta interfaz.

export type CardBrand = "visa" | "mastercard";

export type CardProviderName = "mock" | "visa" | "mastercard";

export type CardholderInput = {
  userId: string;
  firstName: string;
  lastName: string;
  country: string;
  phone?: string;
  email?: string;
};

export type ProviderCardholder = {
  providerCardholderId: string;
  status: "active" | "pending" | "rejected";
};

export type CreateCardInput = {
  cardholderId: string;
  brand: CardBrand;
  currency: string;
  label?: string;
  disposable: boolean;
  /** Clave de idempotencia: LR-CARD-<user>-<fecha>-<n> */
  idempotencyKey: string;
};

/** Metadatos seguros de la tarjeta. Nunca incluye PAN, CVV ni PIN. */
export type ProviderCard = {
  providerCardId: string;
  brand: CardBrand;
  last4: string;
  expMonth: number;
  expYear: number;
  status: "active" | "frozen" | "cancelled";
  currency: string;
  /** true cuando el proveedor es simulado (no existe en la red de tarjetas). */
  simulated: boolean;
};

export type ProviderCardLimits = {
  perTransaction?: number;
  dailyLimit?: number;
  monthlyLimit?: number;
  onlineEnabled?: boolean;
  internationalEnabled?: boolean;
};

export type ProviderTransaction = {
  providerTransactionId: string;
  merchantName: string;
  merchantCategory?: string;
  amount: number;
  currency: string;
  status: "pending" | "authorized" | "declined" | "settled" | "reversed" | "refunded";
  createdAt: string;
};

export interface CardProvider {
  readonly name: CardProviderName;
  /** false cuando el emisor real todavía requiere aprobación/credenciales. */
  readonly live: boolean;
  createCardholder(input: CardholderInput): Promise<ProviderCardholder>;
  createVirtualCard(input: CreateCardInput): Promise<ProviderCard>;
  getCard(cardId: string): Promise<ProviderCard>;
  freezeCard(cardId: string): Promise<void>;
  unfreezeCard(cardId: string): Promise<void>;
  terminateCard(cardId: string): Promise<void>;
  getCardTransactions(cardId: string): Promise<ProviderTransaction[]>;
  updateCardLimits(cardId: string, limits: ProviderCardLimits): Promise<void>;
}

/** Configuración internacional del programa (depende del BIN sponsor real). */
export const CARD_PROGRAM = {
  supportedCurrencies: ["USD", "MXN", "DOP", "HTG", "EUR"],
  supportedCountries: ["HT", "DO", "MX", "US", "CA", "FR", "ES", "CL", "BR"],
  allowedMerchantCategories: ["ecommerce", "digital_services", "subscriptions", "travel"],
  blockedMerchantCategories: ["gambling", "crypto_atm", "adult"],
  internationalUsageEnabled: true,
} as const;
