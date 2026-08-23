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

export type WalletTx = {
  id: string;
  wallet_id: string;
  kind: string;
  amount: number;
  currency: string;
  description: string | null;
  created_at: string;
};

export const WALLET_CURRENCIES = ["HTG"] as const;

export function useWallets() {
  return useQuery({
    queryKey: ["wallets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("wallets").select("*").order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as Wallet[];
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
    for (const key of ["wallets", "wallet_transactions"]) {
      void qc.invalidateQueries({ queryKey: [key] });
    }
  };
}
