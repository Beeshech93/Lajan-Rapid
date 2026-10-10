import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Country, RateConfig } from "@/lib/remesa";

export function useCountries() {
  return useQuery({
    queryKey: ["countries"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("countries")
        .select("*")
        .eq("is_active", true)
        .order("name");
      return (data ?? []) as Country[];
    },
  });
}

/*
 * Tasas de fallback — coinciden con la migración seed.
 * Se usan SOLO si la consulta a exchange_rates retorna null
 * (la tabla aún no tiene datos, RLS bloquea, u otro problema).
 */
const FALLBACK_RATES: Record<string, RateConfig> = {
  "MXN→HTG": { rate: 7.20,    fee_percent: 1.5, fee_fixed: 15,   agent_commission_percent: 0.8 },
  "MXN→DOP": { rate: 3.35,    fee_percent: 2.5, fee_fixed: 25,   agent_commission_percent: 1 },
  "USD→HTG": { rate: 131.00,  fee_percent: 2.5, fee_fixed: 1.5,  agent_commission_percent: 1 },
  "USD→DOP": { rate: 62.00,   fee_percent: 2.5, fee_fixed: 1.5,  agent_commission_percent: 1 },
  "CAD→HTG": { rate: 95.60,   fee_percent: 2.5, fee_fixed: 2,    agent_commission_percent: 1 },
  "CAD→DOP": { rate: 45.30,   fee_percent: 2.5, fee_fixed: 2,    agent_commission_percent: 1 },
  "CLP→HTG": { rate: 0.138,   fee_percent: 2.5, fee_fixed: 1200, agent_commission_percent: 1 },
  "CLP→DOP": { rate: 0.065,   fee_percent: 2.5, fee_fixed: 1200, agent_commission_percent: 1 },
  "BRL→HTG": { rate: 24.26,   fee_percent: 2.5, fee_fixed: 8,    agent_commission_percent: 1 },
  "BRL→DOP": { rate: 11.48,   fee_percent: 2.5, fee_fixed: 8,    agent_commission_percent: 1 },
  "ARS→HTG": { rate: 0.119,   fee_percent: 2.5, fee_fixed: 1500, agent_commission_percent: 1 },
  "ARS→DOP": { rate: 0.056,   fee_percent: 2.5, fee_fixed: 1500, agent_commission_percent: 1 },
  "COP→HTG": { rate: 0.0315,  fee_percent: 2.5, fee_fixed: 6000, agent_commission_percent: 1 },
  "COP→DOP": { rate: 0.0149,  fee_percent: 2.5, fee_fixed: 6000, agent_commission_percent: 1 },
  "PEN→HTG": { rate: 35.00,   fee_percent: 2.5, fee_fixed: 5,    agent_commission_percent: 1 },
  "PEN→DOP": { rate: 16.55,   fee_percent: 2.5, fee_fixed: 5,    agent_commission_percent: 1 },
  "CRC→HTG": { rate: 0.2570,  fee_percent: 2.5, fee_fixed: 2500, agent_commission_percent: 1 },
  "CRC→DOP": { rate: 0.1215,  fee_percent: 2.5, fee_fixed: 2500, agent_commission_percent: 1 },
  "GTQ→HTG": { rate: 17.00,   fee_percent: 2.5, fee_fixed: 12,   agent_commission_percent: 1 },
  "GTQ→DOP": { rate: 8.05,    fee_percent: 2.5, fee_fixed: 12,   agent_commission_percent: 1 },
  "EUR→HTG": { rate: 142.00,  fee_percent: 2.5, fee_fixed: 1.5,  agent_commission_percent: 1 },
  "EUR→DOP": { rate: 67.20,   fee_percent: 2.5, fee_fixed: 1.5,  agent_commission_percent: 1 },
  "GBP→HTG": { rate: 166.00,  fee_percent: 2.5, fee_fixed: 1.2,  agent_commission_percent: 1 },
  "GBP→DOP": { rate: 78.50,   fee_percent: 2.5, fee_fixed: 1.2,  agent_commission_percent: 1 },
  "CHF→HTG": { rate: 150.00,  fee_percent: 2.5, fee_fixed: 1.5,  agent_commission_percent: 1 },
  "CHF→DOP": { rate: 71.00,   fee_percent: 2.5, fee_fixed: 1.5,  agent_commission_percent: 1 },
};

function fallbackRate(from: string, to: string): (RateConfig & { id: string }) | null {
  const fb = FALLBACK_RATES[`${from}→${to}`];
  if (!fb) return null;
  return { ...fb, id: `fallback-${from}-${to}` };
}

export function useRate(fromCurrency?: string, toCurrency?: string) {
  return useQuery({
    queryKey: ["rate", fromCurrency, toCurrency],
    enabled: !!fromCurrency && !!toCurrency,
    queryFn: async () => {
      const { data } = await supabase
        .from("exchange_rates")
        .select("*")
        .eq("is_active", true)
        .eq("from_currency", fromCurrency!)
        .eq("to_currency", toCurrency!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const fb = fallbackRate(fromCurrency!, toCurrency!);

      // Si la base de datos tiene una tasa válida mayor a 0, usarla
      if (data && Number(data.rate) > 0) {
        return data as RateConfig & { id: string };
      }

      // Si la DB no tiene datos o tiene rate <= 0 (accidentalmente guardado como 0),
      // recurrir a la tasa fallback garantizada
      if (fb) {
        // Si el usuario en la DB tenía el tipo de cambio ingresado en fee_fixed por confusión (ej. 7.2):
        const isRateConfusedWithFee =
          data &&
          Number(data.rate) === 0 &&
          Number(data.fee_fixed) > 0 &&
          Number(data.fee_fixed) <= 10 &&
          fromCurrency === "MXN";

        const effectiveRate = isRateConfusedWithFee ? Number(data.fee_fixed) : fb.rate;
        const effectiveFeeFixed = isRateConfusedWithFee
          ? fb.fee_fixed
          : data && Number(data.fee_fixed) >= 0
            ? Number(data.fee_fixed)
            : fb.fee_fixed;
        const effectiveFeePercent =
          data && Number(data.fee_percent) > 0
            ? Number(data.fee_percent)
            : fb.fee_percent;

        return {
          ...fb,
          id: data?.id || fb.id,
          rate: effectiveRate,
          fee_percent: effectiveFeePercent,
          fee_fixed: effectiveFeeFixed,
          agent_commission_percent:
            data?.agent_commission_percent ?? fb.agent_commission_percent,
        };
      }

      return data ? (data as RateConfig & { id: string }) : null;
    },
  });
}

/**
 * Tasa manual específica para recargas móviles (DingConnect), separada de
 * las tasas de envíos de dinero — se configura aparte en /admin para no
 * afectar ni depender de las tasas de exchange_rates.
 */
export function useTopupRate(fromCurrency?: string, toCurrency?: string) {
  return useQuery({
    queryKey: ["topup_rate", fromCurrency, toCurrency],
    enabled: !!fromCurrency && !!toCurrency,
    queryFn: async () => {
      const { data } = await supabase
        .from("topup_rates")
        .select("*")
        .eq("is_active", true)
        .eq("from_currency", fromCurrency!)
        .eq("to_currency", toCurrency!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as { id: string; rate: number } | null;
    },
  });
}
