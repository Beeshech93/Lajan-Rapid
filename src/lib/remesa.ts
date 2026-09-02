export type TransferStatus =
  "created" | "awaiting_payment" | "processing" | "completed" | "cancelled";

export const STATUS_LABEL: Record<TransferStatus, string> = {
  created: "Creado",
  awaiting_payment: "Esperando pago",
  processing: "En proceso",
  completed: "Entregado",
  cancelled: "Cancelado",
};

export const STATUS_TONE: Record<TransferStatus, string> = {
  created: "bg-muted text-muted-foreground",
  awaiting_payment: "bg-warning/15 text-warning",
  processing: "bg-accent/15 text-accent",
  completed: "bg-success/15 text-success",
  cancelled: "bg-destructive/10 text-destructive",
};

export const STATUS_FLOW: TransferStatus[] = ["awaiting_payment", "processing", "completed"];

export type KycStatus = "none" | "pending" | "approved" | "rejected";

export const KYC_LABEL: Record<KycStatus, string> = {
  none: "Sin verificar",
  pending: "En revisión",
  approved: "Verificado",
  rejected: "Rechazado",
};

export const KYC_TONE: Record<KycStatus, string> = {
  none: "bg-muted text-muted-foreground",
  pending: "bg-warning/15 text-warning",
  approved: "bg-success/15 text-success",
  rejected: "bg-destructive/10 text-destructive",
};

export type Country = {
  code: string;
  name: string;
  currency: string;
  flag: string;
  is_origin: boolean;
  is_destination: boolean;
  is_active: boolean;
};

/* ---------- Métodos de pago por país de origen ---------- */

type Method = { value: string; label: string; hint: string };

export const PAYMENT_CATALOG: Record<string, Method> = {
  oxxo: { value: "oxxo", label: "OXXO", hint: "Pago en efectivo en tienda" },
  mercado_pago: { value: "mercado_pago", label: "Mercado Pago", hint: "Saldo o tarjeta" },
  spei: { value: "spei", label: "Transferencia SPEI", hint: "Desde tu banco" },
  card: { value: "card", label: "Tarjeta de débito", hint: "Visa / Mastercard" },
  ach: { value: "ach", label: "Transferencia ACH", hint: "Desde tu banco en EE.UU." },
  zelle: { value: "zelle", label: "Zelle", hint: "Envío instantáneo" },
  interac: { value: "interac", label: "Interac e-Transfer", hint: "Bancos de Canadá" },
  pix: { value: "pix", label: "Pix", hint: "Instantáneo en Brasil" },
  sepa: { value: "sepa", label: "Transferencia SEPA", hint: "Bancos de la zona euro" },
  faster_payments: {
    value: "faster_payments",
    label: "Faster Payments",
    hint: "Bancos del Reino Unido",
  },
  bank_transfer: {
    value: "bank_transfer",
    label: "Transferencia bancaria",
    hint: "Desde tu banco",
  },
  cash_agent: { value: "cash_agent", label: "Efectivo con agente", hint: "Punto autorizado" },
};

const DEFAULT_PAYMENTS = ["bank_transfer", "card", "cash_agent"];

const PAYMENTS_BY_COUNTRY: Record<string, string[]> = {
  MX: ["oxxo", "spei", "mercado_pago", "card"],
  US: ["ach", "zelle", "card", "cash_agent"],
  CA: ["interac", "bank_transfer", "card"],
  BR: ["pix", "bank_transfer", "card"],
  ES: ["sepa", "card", "cash_agent"],
  FR: ["sepa", "card", "cash_agent"],
  DE: ["sepa", "card"],
  IT: ["sepa", "card"],
  PT: ["sepa", "card"],
  NL: ["sepa", "card"],
  BE: ["sepa", "card"],
  CH: ["bank_transfer", "card"],
  GB: ["faster_payments", "bank_transfer", "card"],
};

export function paymentMethods(countryCode: string | undefined): Method[] {
  const keys = (countryCode && PAYMENTS_BY_COUNTRY[countryCode]) || DEFAULT_PAYMENTS;
  return keys.map((k) => PAYMENT_CATALOG[k]!).filter(Boolean);
}

export function paymentLabel(value: string): string {
  return PAYMENT_CATALOG[value]?.label ?? value;
}

/* ---------- Entrega y ciudades por país de destino ---------- */

export const DELIVERY_CATALOG: Record<string, Method> = {
  moncash: {
    value: "moncash",
    label: "MonCash",
    hint: "Billetera móvil Digicel (Haití)",
  },
  natcash: {
    value: "natcash",
    label: "NatCash",
    hint: "Billetera móvil Natcom (Haití)",
  },
};

export const DELIVERY_KEYS = ["moncash", "natcash"] as const;

export function deliveryMethods(_countryCode?: string | undefined): Method[] {
  return DELIVERY_KEYS.map((k) => DELIVERY_CATALOG[k]!);
}

export function deliveryLabel(value: string): string {
  return DELIVERY_CATALOG[value]?.label ?? value;
}

export const CITIES_BY_COUNTRY: Record<string, string[]> = {
  HT: [
    "Port-au-Prince",
    "Cap-Haïtien",
    "Gonaïves",
    "Les Cayes",
    "Jacmel",
    "Jérémie",
    "Hinche",
    "Port-de-Paix",
  ],
  DO: [
    "Santo Domingo",
    "Santiago de los Caballeros",
    "La Romana",
    "San Pedro de Macorís",
    "Puerto Plata",
    "San Cristóbal",
    "Higüey",
    "Barahona",
  ],
};

export function citiesFor(countryCode: string | undefined): string[] {
  return (countryCode && CITIES_BY_COUNTRY[countryCode]) || [];
}

/* ---------- Cotización ---------- */

export type RateConfig = {
  rate: number;
  fee_percent: number;
  fee_fixed: number;
  agent_commission_percent: number;
};

export type Quote = {
  amount: number;
  fee: number;
  total: number;
  receives: number;
  commission: number;
};

export const ZERO_RATE: RateConfig = {
  rate: 0,
  fee_percent: 0,
  fee_fixed: 0,
  agent_commission_percent: 0,
};

export function quote(amount: number, cfg: RateConfig): Quote {
  const safe = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const fee = round2(
    safe * (Number(cfg.fee_percent) / 100) + (safe > 0 ? Number(cfg.fee_fixed) : 0),
  );
  return {
    amount: round2(safe),
    fee,
    total: round2(safe + fee),
    receives: round2(safe * Number(cfg.rate)),
    commission: round2(safe * (Number(cfg.agent_commission_percent) / 100)),
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

const ISO_CURRENCIES = new Set([
  "MXN",
  "USD",
  "CAD",
  "CLP",
  "BRL",
  "ARS",
  "COP",
  "PEN",
  "CRC",
  "GTQ",
  "EUR",
  "GBP",
  "CHF",
  "DOP",
  "HTG",
]);

export function money(n: number, currency: string): string {
  const value = Number.isFinite(n) ? n : 0;
  if (ISO_CURRENCIES.has(currency)) {
    try {
      return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency,
        currencyDisplay: "code",
      }).format(value);
    } catch {
      /* fallthrough */
    }
  }
  return `${new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${currency}`;
}

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
