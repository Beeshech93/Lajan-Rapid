export interface TenantBranding {
  logoUrl?: string | undefined;
  logoDarkUrl?: string | undefined;
  faviconUrl?: string | undefined;
  appIconUrl?: string | undefined;
  primaryColor: string; // e.g. '#10b981'
  primaryDarkColor?: string | undefined; // e.g. '#047857'
  accentColor: string; // e.g. '#34d399'
  backgroundColor?: string | undefined; // e.g. '#0b1426'
  surfaceColor?: string | undefined; // e.g. '#121d33'
  textColor?: string | undefined; // e.g. '#f8fafc'
  fontFamily?: string | undefined;
  borderRadius?: string | undefined;
}

export interface TenantContent {
  slogan?: string | undefined;
  tagline?: string | undefined;
  supportEmail?: string | undefined;
  supportPhone?: string | undefined;
  supportWhatsapp?: string | undefined;
  address?: string | undefined;
  termsUrl?: string | undefined;
  privacyUrl?: string | undefined;
}

export interface TenantSettings {
  allowedOrigins?: string[] | undefined;
  allowedDestinations?: string[] | undefined;
  feeMarkupPercent?: number | undefined; // e.g. 0.5 for +0.5%
  feeMarkupFixed?: number | undefined; // e.g. 1.0 for +1.00
  enabledServices: {
    transfers: boolean;
    topups: boolean;
    crypto: boolean;
    virtualCards: boolean;
  };
}

export interface TenantApis {
  mercadoPago?: {
    enabled?: boolean | undefined;
    publicKey?: string | undefined;
    accessToken?: string | undefined;
    webhookSecret?: string | undefined;
  } | undefined;
  stripe?: {
    enabled?: boolean | undefined;
    publishableKey?: string | undefined;
    secretKey?: string | undefined;
    webhookSecret?: string | undefined;
  } | undefined;
  bazik?: {
    enabled?: boolean | undefined;
    apiKey?: string | undefined;
    apiSecret?: string | undefined;
    endpoint?: string | undefined;
  } | undefined;
  dingConnect?: {
    enabled?: boolean | undefined;
    apiKey?: string | undefined;
  } | undefined;
  resend?: {
    enabled?: boolean | undefined;
    apiKey?: string | undefined;
    fromEmail?: string | undefined;
  } | undefined;
  webhooks?: {
    enabled?: boolean | undefined;
    url?: string | undefined;
    secretKey?: string | undefined;
  } | undefined;
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  legalName?: string | undefined;
  isDefault: boolean;
  isActive: boolean;
  domain?: string | null | undefined;
  subdomain?: string | null | undefined;
  branding: TenantBranding;
  content: TenantContent;
  settings: TenantSettings;
  apis?: TenantApis | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  branding: TenantBranding;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "lajan-emerald",
    name: "Lajan Emerald (Oficial)",
    description: "Verde esmeralda sobre azul marino profundo, moderno y confiable.",
    branding: {
      primaryColor: "#10b981",
      primaryDarkColor: "#059669",
      accentColor: "#34d399",
      backgroundColor: "#0b1426",
      surfaceColor: "#121d33",
      textColor: "#f8fafc",
      borderRadius: "1.25rem",
    },
  },
  {
    id: "royal-sapphire",
    name: "Royal Sapphire",
    description: "Azul zafiro corporativo para fintechs institucionales y banca.",
    branding: {
      primaryColor: "#2563eb",
      primaryDarkColor: "#1d4ed8",
      accentColor: "#60a5fa",
      backgroundColor: "#0a0f1d",
      surfaceColor: "#111827",
      textColor: "#f9fafb",
      borderRadius: "1rem",
    },
  },
  {
    id: "sunset-gold",
    name: "Sunset Amber & Gold",
    description: "Dorado vibrante y ámbar cálido para remesas caribeñas.",
    branding: {
      primaryColor: "#f59e0b",
      primaryDarkColor: "#d97706",
      accentColor: "#fbbf24",
      backgroundColor: "#120e09",
      surfaceColor: "#1c160e",
      textColor: "#fffbeb",
      borderRadius: "1.25rem",
    },
  },
  {
    id: "ruby-red",
    name: "Ruby Express",
    description: "Rojo carmesí de alto impacto, energético y dinámico.",
    branding: {
      primaryColor: "#ef4444",
      primaryDarkColor: "#dc2626",
      accentColor: "#f87171",
      backgroundColor: "#140a0a",
      surfaceColor: "#1f1212",
      textColor: "#fef2f2",
      borderRadius: "1rem",
    },
  },
  {
    id: "violet-pulse",
    name: "Violet Fintech",
    description: "Púrpura y violeta eléctrico para aplicaciones neobanco.",
    branding: {
      primaryColor: "#8b5cf6",
      primaryDarkColor: "#7c3aed",
      accentColor: "#a78bfa",
      backgroundColor: "#0d0b18",
      surfaceColor: "#17142b",
      textColor: "#faf5ff",
      borderRadius: "1.5rem",
    },
  },
  {
    id: "titanium-dark",
    name: "Titanium Monocromo",
    description: "Gama monocromática minimalista de alta elegancia.",
    branding: {
      primaryColor: "#e2e8f0",
      primaryDarkColor: "#cbd5e1",
      accentColor: "#94a3b8",
      backgroundColor: "#000000",
      surfaceColor: "#121212",
      textColor: "#ffffff",
      borderRadius: "0.85rem",
    },
  },
];

// Marca principal predeterminada (Lajan Rapid)
export const DEFAULT_LAJAN_RAPID_TENANT: Tenant = {
  id: "00000000-0000-0000-0000-000000000001",
  slug: "default",
  name: "Lajan Rapid",
  legalName: "Lajan Rapid Financial Services S.R.L.",
  isDefault: true,
  isActive: true,
  domain: "lajanrapid.com",
  subdomain: "app",
  branding: {
    primaryColor: "#10b981",
    primaryDarkColor: "#059669",
    accentColor: "#34d399",
    backgroundColor: "#0b1426",
    surfaceColor: "#121d33",
    textColor: "#f8fafc",
    fontFamily: "Sora, sans-serif",
    borderRadius: "1.25rem",
  },
  content: {
    slogan: "Envía dinero y recarga a Haití en minutos",
    tagline: "El servicio más rápido y seguro de remesas directas a MonCash y NatCash",
    supportEmail: "lajanrapid26@gmail.com",
    supportPhone: "+1 (829) 341-7169",
    supportWhatsapp: "18293417169",
    address: "Santo Domingo, República Dominicana",
  },
  settings: {
    allowedOrigins: ["DO", "MX", "US", "CA", "BR", "CL", "ES", "FR"],
    allowedDestinations: ["HT"],
    feeMarkupPercent: 0,
    feeMarkupFixed: 0,
    enabledServices: {
      transfers: true,
      topups: true,
      crypto: true,
      virtualCards: true,
    },
  },
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-11-14T00:00:00Z",
};

// Empresa Piloto 1: VipPip Express (Fintech Azul Real)
export const PILOT_VIPPIP_TENANT: Tenant = {
  id: "00000000-0000-0000-0000-000000000002",
  slug: "vippip",
  name: "VipPip Express",
  legalName: "VipPip Global Remittance S.A.",
  isDefault: false,
  isActive: true,
  domain: "vippip.lajanrapid.app",
  subdomain: "vippip",
  branding: {
    primaryColor: "#2563eb",
    primaryDarkColor: "#1d4ed8",
    accentColor: "#60a5fa",
    backgroundColor: "#0a0f1d",
    surfaceColor: "#111827",
    textColor: "#f9fafb",
    fontFamily: "Sora, sans-serif",
    borderRadius: "1rem",
  },
  content: {
    slogan: "Transferencias directas y seguras a Haití",
    tagline: "Tu aliado confiable para enviar a MonCash y NatCash sin intermediarios",
    supportEmail: "soporte@vippip.com",
    supportPhone: "+1 (800) 847-7470",
    supportWhatsapp: "18008477470",
    address: "Miami, FL & Santo Domingo, RD",
  },
  settings: {
    allowedOrigins: ["DO", "MX", "US", "CA", "BR", "CL", "ES", "FR"],
    allowedDestinations: ["HT"],
    feeMarkupPercent: 0.5,
    feeMarkupFixed: 0,
    enabledServices: {
      transfers: true,
      topups: true,
      crypto: true,
      virtualCards: true,
    },
  },
  createdAt: "2026-11-15T00:00:00Z",
  updatedAt: "2026-11-15T00:00:00Z",
};

// Empresa Piloto 2: Kash Ayiti (Fintech Ámbar y Oro)
export const PILOT_KASH_AYITI_TENANT: Tenant = {
  id: "00000000-0000-0000-0000-000000000003",
  slug: "kash-ayiti",
  name: "Kash Ayiti",
  legalName: "Kash Ayiti Financial Services Ltd.",
  isDefault: false,
  isActive: true,
  domain: "kashayiti.lajanrapid.app",
  subdomain: "kashayiti",
  branding: {
    primaryColor: "#f59e0b",
    primaryDarkColor: "#d97706",
    accentColor: "#fbbf24",
    backgroundColor: "#120e09",
    surfaceColor: "#1c160e",
    textColor: "#fffbeb",
    fontFamily: "Sora, sans-serif",
    borderRadius: "1.25rem",
  },
  content: {
    slogan: "Voye lajan bay fanmi w an sekirite",
    tagline: "Sèvis transfè lajan ki pi rapid pou Ayiti depi tout peyi",
    supportEmail: "contact@kashayiti.com",
    supportPhone: "+1 (829) 555-0199",
    supportWhatsapp: "18295550199",
    address: "Pétion-Ville, Haïti & Santiago, RD",
  },
  settings: {
    allowedOrigins: ["DO", "MX", "US", "CA", "BR", "CL", "ES", "FR"],
    allowedDestinations: ["HT"],
    feeMarkupPercent: 0.75,
    feeMarkupFixed: 1.0,
    enabledServices: {
      transfers: true,
      topups: true,
      crypto: true,
      virtualCards: true,
    },
  },
  createdAt: "2026-11-15T00:00:00Z",
  updatedAt: "2026-11-15T00:00:00Z",
};

export const INITIAL_WHITE_LABEL_TENANTS: Tenant[] = [
  DEFAULT_LAJAN_RAPID_TENANT,
  PILOT_VIPPIP_TENANT,
  PILOT_KASH_AYITI_TENANT,
];
