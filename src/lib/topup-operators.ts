// Catálogo local de operadores por país para recargas.
// Se usa para ordenar/etiquetar el catálogo del proveedor y como respaldo
// cuando el catálogo remoto no está disponible.

export type TopupCountry = {
  code: string;
  label: string;
  dialCode: string;
  placeholder: string;
  operators: string[];
};

export const TOPUP_COUNTRIES: TopupCountry[] = [
  {
    code: "HT",
    label: "🇭🇹 Haití",
    dialCode: "+509",
    placeholder: "+509 3412 3456",
    operators: ["Digicel", "Natcom"],
  },
  {
    code: "DO",
    label: "🇩🇴 República Dominicana",
    dialCode: "+1",
    placeholder: "+1 809 123 4567",
    operators: ["Claro", "Altice", "Viva"],
  },
  {
    code: "MX",
    label: "🇲🇽 México",
    dialCode: "+52",
    placeholder: "+52 55 1234 5678",
    operators: ["Telcel", "AT&T", "Movistar", "Unefon", "Virgin Mobile"],
  },
  {
    code: "US",
    label: "🇺🇸 Estados Unidos",
    dialCode: "+1",
    placeholder: "+1 305 123 4567",
    operators: ["T-Mobile", "AT&T", "Verizon", "Lycamobile", "Simple Mobile"],
  },
  {
    code: "CU",
    label: "🇨🇺 Cuba",
    dialCode: "+53",
    placeholder: "+53 5 123 4567",
    operators: ["Cubacel"],
  },
  {
    code: "JM",
    label: "🇯🇲 Jamaica",
    dialCode: "+1",
    placeholder: "+1 876 123 4567",
    operators: ["Digicel", "Flow"],
  },
  {
    code: "BR",
    label: "🇧🇷 Brasil",
    dialCode: "+55",
    placeholder: "+55 11 91234 5678",
    operators: ["Vivo", "Claro", "TIM", "Oi"],
  },
  {
    code: "CO",
    label: "🇨🇴 Colombia",
    dialCode: "+57",
    placeholder: "+57 300 123 4567",
    operators: ["Claro", "Movistar", "Tigo", "WOM"],
  },
];

export function findTopupCountry(code: string): TopupCountry | undefined {
  return TOPUP_COUNTRIES.find((c) => c.code === code);
}

/** Nombre "bonito" del operador: usa el catálogo local si hay coincidencia. */
export function prettyOperator(countryCode: string, raw: string): string {
  const cleaned = raw.replace(/[_-]+/g, " ").trim();
  const known = findTopupCountry(countryCode)?.operators ?? [];
  const match = known.find(
    (op) =>
      cleaned.toLowerCase().includes(op.toLowerCase()) ||
      op.toLowerCase().includes(cleaned.toLowerCase()),
  );
  return match ?? (cleaned || raw);
}
