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

/** Une código de país y número local en formato E.164. */
export function toE164(dial: string, local: string): string | null {
  const digits = local.replace(/\D/g, "").replace(/^0+/, "");
  const prefix = dial.replace(/\D/g, "");
  if (digits.length < 5 || digits.length > 14) return null;
  const full = `+${prefix}${digits}`;
  return /^\+[1-9]\d{6,15}$/.test(full) ? full : null;
}
