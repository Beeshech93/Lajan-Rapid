import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Wallet = {
  id: string;
  user_id: string;
  currency: string;
  balance: number;
  status: string;
  created_at: string;
};

export type VirtualCard = {
  id: string;
  user_id: string;
  wallet_id: string;
  provider: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  status: string;
  is_disposable: boolean;
  label: string | null;
  created_at: string;
};

export type CardTx = {
  id: string;
  card_id: string;
  merchant: string;
  amount: number;
  currency: string;
  status: string;
  decline_reason: string | null;
  created_at: string;
};

export type WalletTx = {
  id: string;
  wallet_id: string;
  kind: string;
  amount: number;
  currency: string;
  description: string | null;
  created_at: string;
};

export const WALLET_CURRENCIES = ["MXN", "USD", "HTG", "DOP", "EUR"] as const;

export function useWallets() {
  return useQuery({
    queryKey: ["wallets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallets")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as Wallet[];
    },
  });
}

export function useCards() {
  return useQuery({
    queryKey: ["virtual_cards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("virtual_cards")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as VirtualCard[];
    },
  });
}

export function useCardTransactions() {
  return useQuery({
    queryKey: ["card_transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("card_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as CardTx[];
    },
  });
}

export function useWalletTransactions() {
  return useQuery({
    queryKey: ["wallet_transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as WalletTx[];
    },
  });
}

export function useRefreshWallet() {
  const qc = useQueryClient();
  return () => {
    for (const key of [
      "wallets",
      "virtual_cards",
      "card_transactions",
      "wallet_transactions",
      "card_limits",
    ]) {
      void qc.invalidateQueries({ queryKey: [key] });
    }
  };
}
