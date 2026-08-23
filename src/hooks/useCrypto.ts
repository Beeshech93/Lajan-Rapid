import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CryptoAsset = {
  id: string;
  code: string;
  network: string;
  name: string;
  deposit_address: string;
  htg_rate: number;
  min_deposit: number;
  fee_percent: number;
  is_active: boolean;
};

export type CryptoDeposit = {
  id: string;
  user_id: string;
  asset_id: string;
  reference: string;
  amount_crypto: number;
  tx_hash: string;
  rate: number;
  amount_htg: number;
  status: string;
  review_notes: string | null;
  created_at: string;
};

export type CryptoWithdrawal = {
  id: string;
  user_id: string;
  kind: string;
  asset_id: string | null;
  reference: string;
  destination: string;
  amount_htg: number;
  amount_crypto: number;
  rate: number;
  status: string;
  provider_ref: string | null;
  review_notes: string | null;
  created_at: string;
};

export const CRYPTO_KEYS = [
  "crypto_assets",
  "crypto_deposits",
  "crypto_withdrawals",
  "wallets",
  "wallet_transactions",
];

export function useCryptoAssets(all = false) {
  return useQuery({
    queryKey: ["crypto_assets", all],
    queryFn: async () => {
      let q = supabase.from("crypto_assets").select("*").order("code");
      if (!all) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as CryptoAsset[];
    },
  });
}

export function useCryptoDeposits() {
  return useQuery({
    queryKey: ["crypto_deposits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crypto_deposits")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as CryptoDeposit[];
    },
  });
}

export function useCryptoWithdrawals() {
  return useQuery({
    queryKey: ["crypto_withdrawals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crypto_withdrawals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as CryptoWithdrawal[];
    },
  });
}

export function useRefreshCrypto() {
  const qc = useQueryClient();
  return () => {
    for (const key of CRYPTO_KEYS) void qc.invalidateQueries({ queryKey: [key] });
  };
}
