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
      return (data as (RateConfig & { id: string }) | null) ?? null;
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
