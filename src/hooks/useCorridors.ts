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
