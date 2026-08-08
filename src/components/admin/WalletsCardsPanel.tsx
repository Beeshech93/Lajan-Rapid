import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { money, shortDate } from "@/lib/remesa";

export function WalletsCardsPanel() {
  const qc = useQueryClient();
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const { data: wallets } = useQuery({
    queryKey: ["admin_wallets"],
    queryFn: async () => {
      const { data } = await supabase
        .from("wallets")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: cards } = useQuery({
    queryKey: ["admin_cards"],
    queryFn: async () => {
      const { data } = await supabase
        .from("virtual_cards")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: txs } = useQuery({
    queryKey: ["admin_card_txs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("card_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const refresh = () => {
    for (const k of ["admin_wallets", "admin_cards", "admin_card_txs"]) {
      void qc.invalidateQueries({ queryKey: [k] });
    }
  };

  const adjust = async (walletId: string, sign: 1 | -1) => {
    const value = Number(amounts[walletId]);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Indica un monto válido");
      return;
    }
    const { error } = await supabase.rpc("admin_adjust_wallet", {
      _wallet_id: walletId,
      _amount: sign * value,
      _description: sign > 0 ? "Abono manual de administración" : "Cargo manual de administración",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Saldo actualizado");
    setAmounts((a) => ({ ...a, [walletId]: "" }));
    refresh();
  };

  const toggleCard = async (id: string, status: string) => {
    const { error } = await supabase.rpc("set_card_status", {
      _card_id: id,
      _status: status === "active" ? "frozen" : "active",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Tarjeta actualizada");
    refresh();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Billeteras</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(wallets ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Sin billeteras registradas.</p>
          )}
          {(wallets ?? []).map((w) => (
            <div
              key={w.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-0"
            >
              <div>
                <p className="text-sm font-medium">
                  {w.currency} · {money(Number(w.balance), w.currency)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Usuario {w.user_id.slice(0, 8)} · {shortDate(w.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  className="w-28"
                  placeholder="Monto"
                  inputMode="decimal"
                  value={amounts[w.id] ?? ""}
                  onChange={(e) => setAmounts((a) => ({ ...a, [w.id]: e.target.value }))}
                />
                <Button size="sm" onClick={() => adjust(w.id, 1)}>
                  Abonar
                </Button>
                <Button size="sm" variant="outline" onClick={() => adjust(w.id, -1)}>
                  Cargar
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tarjetas virtuales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(cards ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Sin tarjetas emitidas.</p>
          )}
          {(cards ?? []).map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-0"
            >
              <div>
                <p className="text-sm font-medium uppercase">
                  {c.brand} •••• {c.last4}
                </p>
                <p className="text-xs text-muted-foreground">
                  Usuario {c.user_id.slice(0, 8)} · vence{" "}
                  {String(c.exp_month).padStart(2, "0")}/{String(c.exp_year).slice(-2)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={c.status === "active" ? "secondary" : "outline"}>{c.status}</Badge>
                {c.status !== "cancelled" && (
                  <Button size="sm" variant="outline" onClick={() => toggleCard(c.id, c.status)}>
                    {c.status === "active" ? "Bloquear" : "Desbloquear"}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compras con tarjeta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(txs ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Sin movimientos.</p>
          )}
          {(txs ?? []).map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between border-b py-2 text-sm last:border-0"
            >
              <div>
                <p className="font-medium">{t.merchant}</p>
                <p className="text-xs text-muted-foreground">{shortDate(t.created_at)}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{money(Number(t.amount), t.currency)}</p>
                <Badge variant={t.status === "approved" ? "secondary" : "destructive"}>
                  {t.status}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
