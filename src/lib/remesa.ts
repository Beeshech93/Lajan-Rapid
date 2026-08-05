export type TransferStatus =
  | "created"
  | "awaiting_payment"
  | "paid"
  | "processing"
  | "ready_for_pickup"
  | "completed"
  | "cancelled";

export const STATUS_LABEL: Record<TransferStatus, string> = {
  created: "Creado",
  awaiting_payment: "Esperando pago",
  paid: "Pago recibido",
  processing: "En proceso",
  ready_for_pickup: "Listo para retirar",
  completed: "Entregado",
  cancelled: "Cancelado",
};

export const STATUS_TONE: Record<TransferStatus, string> = {
  created: "bg-muted text-muted-foreground",
  awaiting_payment: "bg-warning/15 text-warning-foreground",
  paid: "bg-accent/15 text-accent-foreground",
  processing: "bg-accent/15 text-accent-foreground",
  ready_for_pickup: "bg-primary/10 text-primary",
  completed: "bg-success/15 text-success",
  cancelled: "bg-destructive/10 text-destructive",
};

export const STATUS_FLOW: TransferStatus[] = [
  "awaiting_payment",
  "paid",
  "processing",
  "ready_for_pickup",
  "completed",
];

export type KycStatus = "unverified" | "pending" | "approved" | "rejected";

export const KYC_LABEL: Record<KycStatus, string> = {
  unverified: "Sin verificar",
  pending: "En revisión",
  approved: "Verificado",
  rejected: "Rechazado",
};

export const KYC_TONE: Record<KycStatus, string> = {
  unverified: "bg-muted text-muted-foreground",
  pending: "bg-warning/15 text-warning-foreground",
  approved: "bg-success/15 text-success",
  rejected: "bg-destructive/10 text-destructive",
};


export const PAYMENT_METHODS = [
  { value: "oxxo", label: "OXXO", hint: "Pago en efectivo en tienda" },
  { value: "mercado_pago", label: "Mercado Pago", hint: "Saldo o tarjeta" },
  { value: "spei", label: "Transferencia SPEI", hint: "Desde tu banco" },
  { value: "card", label: "Tarjeta de débito", hint: "Visa / Mastercard" },
] as const;

export const DELIVERY_METHODS = [
  { value: "cash_pickup", label: "Retiro en efectivo", hint: "Sucursal aliada en Haití" },
  { value: "bank_deposit", label: "Depósito bancario", hint: "Cuenta en gourdes" },
  { value: "mobile_wallet", label: "Billetera móvil", hint: "MonCash y similares" },
] as const;

export const HAITI_CITIES = [
  "Port-au-Prince",
  "Cap-Haïtien",
  "Gonaïves",
  "Les Cayes",
  "Jacmel",
  "Jérémie",
  "Hinche",
  "Port-de-Paix",
];

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

export function quote(amount: number, cfg: RateConfig): Quote {
  const safe = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const fee = round2(safe * (cfg.fee_percent / 100) + (safe > 0 ? cfg.fee_fixed : 0));
  return {
    amount: round2(safe),
    fee,
    total: round2(safe + fee),
    receives: round2(safe * cfg.rate),
    commission: round2(safe * (cfg.agent_commission_percent / 100)),
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export const mxn = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n ?? 0);

export const htg = (n: number) =>
  `${new Intl.NumberFormat("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n ?? 0)} HTG`;

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
