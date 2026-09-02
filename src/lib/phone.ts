export type DialCountry = { code: string; name: string; dial: string; flag: string };

/** Códigos telefónicos internacionales (cualquier país puede registrarse). */
export const DIAL_COUNTRIES: DialCountry[] = [
  { code: "HT", name: "Haïti", dial: "+509", flag: "🇭🇹" },
  { code: "DO", name: "República Dominicana", dial: "+1809", flag: "🇩🇴" },
  { code: "MX", name: "México", dial: "+52", flag: "🇲🇽" },
  { code: "US", name: "United States", dial: "+1", flag: "🇺🇸" },
  { code: "CA", name: "Canada", dial: "+1", flag: "🇨🇦" },
  { code: "AR", name: "Argentina", dial: "+54", flag: "🇦🇷" },
  { code: "BO", name: "Bolivia", dial: "+591", flag: "🇧🇴" },
  { code: "BR", name: "Brasil", dial: "+55", flag: "🇧🇷" },
  { code: "CL", name: "Chile", dial: "+56", flag: "🇨🇱" },
  { code: "CO", name: "Colombia", dial: "+57", flag: "🇨🇴" },
  { code: "CR", name: "Costa Rica", dial: "+506", flag: "🇨🇷" },
  { code: "CU", name: "Cuba", dial: "+53", flag: "🇨🇺" },
  { code: "EC", name: "Ecuador", dial: "+593", flag: "🇪🇨" },
  { code: "SV", name: "El Salvador", dial: "+503", flag: "🇸🇻" },
  { code: "GT", name: "Guatemala", dial: "+502", flag: "🇬🇹" },
  { code: "HN", name: "Honduras", dial: "+504", flag: "🇭🇳" },
  { code: "JM", name: "Jamaica", dial: "+1876", flag: "🇯🇲" },
  { code: "NI", name: "Nicaragua", dial: "+505", flag: "🇳🇮" },
  { code: "PA", name: "Panamá", dial: "+507", flag: "🇵🇦" },
  { code: "PY", name: "Paraguay", dial: "+595", flag: "🇵🇾" },
  { code: "PE", name: "Perú", dial: "+51", flag: "🇵🇪" },
  { code: "PR", name: "Puerto Rico", dial: "+1787", flag: "🇵🇷" },
  { code: "UY", name: "Uruguay", dial: "+598", flag: "🇺🇾" },
  { code: "VE", name: "Venezuela", dial: "+58", flag: "🇻🇪" },
  { code: "ES", name: "España", dial: "+34", flag: "🇪🇸" },
  { code: "FR", name: "France", dial: "+33", flag: "🇫🇷" },
  { code: "DE", name: "Deutschland", dial: "+49", flag: "🇩🇪" },
  { code: "IT", name: "Italia", dial: "+39", flag: "🇮🇹" },
  { code: "PT", name: "Portugal", dial: "+351", flag: "🇵🇹" },
  { code: "NL", name: "Nederland", dial: "+31", flag: "🇳🇱" },
  { code: "BE", name: "Belgique", dial: "+32", flag: "🇧🇪" },
  { code: "CH", name: "Schweiz", dial: "+41", flag: "🇨🇭" },
  { code: "AT", name: "Österreich", dial: "+43", flag: "🇦🇹" },
  { code: "GB", name: "United Kingdom", dial: "+44", flag: "🇬🇧" },
  { code: "IE", name: "Ireland", dial: "+353", flag: "🇮🇪" },
  { code: "SE", name: "Sverige", dial: "+46", flag: "🇸🇪" },
  { code: "NO", name: "Norge", dial: "+47", flag: "🇳🇴" },
  { code: "DK", name: "Danmark", dial: "+45", flag: "🇩🇰" },
  { code: "FI", name: "Suomi", dial: "+358", flag: "🇫🇮" },
  { code: "PL", name: "Polska", dial: "+48", flag: "🇵🇱" },
  { code: "CZ", name: "Česko", dial: "+420", flag: "🇨🇿" },
  { code: "RO", name: "România", dial: "+40", flag: "🇷🇴" },
  { code: "GR", name: "Ελλάδα", dial: "+30", flag: "🇬🇷" },
  { code: "TR", name: "Türkiye", dial: "+90", flag: "🇹🇷" },
  { code: "MA", name: "Maroc", dial: "+212", flag: "🇲🇦" },
  { code: "SN", name: "Sénégal", dial: "+221", flag: "🇸🇳" },
  { code: "CI", name: "Côte d'Ivoire", dial: "+225", flag: "🇨🇮" },
  { code: "CD", name: "RD Congo", dial: "+243", flag: "🇨🇩" },
  { code: "NG", name: "Nigeria", dial: "+234", flag: "🇳🇬" },
  { code: "ZA", name: "South Africa", dial: "+27", flag: "🇿🇦" },
  { code: "AE", name: "الإمارات", dial: "+971", flag: "🇦🇪" },
  { code: "IN", name: "India", dial: "+91", flag: "🇮🇳" },
  { code: "PH", name: "Philippines", dial: "+63", flag: "🇵🇭" },
  { code: "CN", name: "中国", dial: "+86", flag: "🇨🇳" },
  { code: "JP", name: "日本", dial: "+81", flag: "🇯🇵" },
  { code: "AU", name: "Australia", dial: "+61", flag: "🇦🇺" },
];

/** Longitud (dígitos del número nacional) esperada por país. */
const NATIONAL_LENGTHS: Record<string, number[]> = {
  HT: [8],
  DO: [7],
  PR: [7],
  JM: [7],
  US: [10],
  CA: [10],
  MX: [10],
  AR: [10],
  BO: [8],
  BR: [10, 11],
  CL: [9],
  CO: [10],
  CR: [8],
  CU: [8],
  EC: [9],
  SV: [8],
  GT: [8],
  HN: [8],
  NI: [8],
  PA: [8],
  PY: [9],
  PE: [9],
  UY: [8],
  VE: [10],
  ES: [9],
  FR: [9],
  DE: [10, 11],
  IT: [9, 10],
  PT: [9],
  NL: [9],
  BE: [9],
  CH: [9],
  AT: [10, 11],
  GB: [10],
  IE: [9],
  SE: [9],
  NO: [8],
  DK: [8],
  FI: [9],
  PL: [9],
  CZ: [9],
  RO: [9],
  GR: [10],
  TR: [10],
  MA: [9],
  SN: [9],
  CI: [10],
  CD: [9],
  NG: [10],
  ZA: [9],
  AE: [9],
  IN: [10],
  PH: [10],
  CN: [11],
  JP: [10],
  AU: [9],
};

/** Solo dígitos, sin ceros ni prefijo internacional al inicio. */
export function normalizeLocal(local: string, dial?: string): string {
  let digits = local.replace(/\D/g, "");
  const prefix = dial?.replace(/\D/g, "");
  if (prefix && digits.startsWith(prefix) && digits.length > prefix.length) {
    digits = digits.slice(prefix.length);
  }
  return digits.replace(/^0+/, "");
}

export function expectedLengths(countryCode: string): number[] {
  return NATIONAL_LENGTHS[countryCode] ?? [];
}

/** Formatea el número nacional en grupos legibles según el país. */
export function formatNational(countryCode: string, local: string, dial?: string): string {
  const d = normalizeLocal(local, dial);
  if (!d) return "";
  const groups: Record<string, number[]> = {
    HT: [4, 4],
    DO: [3, 4],
    PR: [3, 4],
    JM: [3, 4],
    US: [3, 3, 4],
    CA: [3, 3, 4],
    MX: [2, 4, 4],
    FR: [1, 2, 2, 2, 2],
    ES: [3, 3, 3],
  };
  const pattern = groups[countryCode] ?? [3, 3, 4];
  const out: string[] = [];
  let i = 0;
  for (const size of pattern) {
    if (i >= d.length) break;
    out.push(d.slice(i, i + size));
    i += size;
  }
  if (i < d.length) out.push(d.slice(i));
  return out.join(" ");
}

export type PhoneCheck = {
  ok: boolean;
  e164?: string;
  error?: "empty" | "short" | "long" | "invalid";
};

/** Valida el número nacional contra el país y devuelve E.164. */
export function validatePhone(countryCode: string, dial: string, local: string): PhoneCheck {
  const digits = normalizeLocal(local, dial);
  if (!digits) return { ok: false, error: "empty" };
  const lengths = expectedLengths(countryCode);
  if (lengths.length) {
    const min = Math.min(...lengths);
    const max = Math.max(...lengths);
    if (digits.length < min) return { ok: false, error: "short" };
    if (digits.length > max) return { ok: false, error: "long" };
    if (!lengths.includes(digits.length)) return { ok: false, error: "invalid" };
  } else if (digits.length < 5 || digits.length > 14) {
    return { ok: false, error: digits.length < 5 ? "short" : "long" };
  }
  const e164 = toE164(dial, digits);
  return e164 ? { ok: true, e164 } : { ok: false, error: "invalid" };
}

/** Une código de país y número local en formato E.164. */
export function toE164(dial: string, local: string): string | null {
  const digits = normalizeLocal(local, dial);
  const prefix = dial.replace(/\D/g, "");
  if (digits.length < 5 || digits.length > 14) return null;
  const full = `+${prefix}${digits}`;
  return /^\+[1-9]\d{6,15}$/.test(full) ? full : null;
}
