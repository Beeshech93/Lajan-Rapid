import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownToLine, ArrowLeftRight, Plus, Wallet as WalletIcon } from "lucide-react";
import { bazikTopupWallet } from "@/lib/bazik.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { money, shortDate } from "@/lib/remesa";
import {
  WALLET_CURRENCIES,
  useRefreshWallet,
  useWalletTransactions,
  useWallets,
} from "@/hooks/useWallet";

export const Route = createFileRoute("/_authenticated/billetera")({
  head: () => ({
    meta: [
      { title: "Billetera — Lajan Rapid" },
      {
        name: "description",
        content: "Consulta tu saldo, convierte entre MXN, USD y HTG y revisa tus movimientos.",
      },
      { property: "og:title", content: "Billetera — Lajan Rapid" },
      { property: "og:description", content: "Saldo multidivisa y movimientos de tu billetera." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Billetera,
});

const KIND_LABEL: Record<string, string> = {
  deposit: "Depósito",
  withdrawal: "Retiro",
  conversion_in: "Conversión recibida",
  conversion_out: "Conversión enviada",
  card_purchase: "Compra con tarjeta",
};

function Billetera() {
  const { data: wallets, isLoading } = useWallets();
  const { data: movements } = useWalletTransactions();
  const refresh = useRefreshWallet();

  const [newCurrency, setNewCurrency] = useState("USD");
  const [fromWallet, setFromWallet] = useState("");
  const [toCurrency, setToCurrency] = useState("HTG");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [topupWallet, setTopupWallet] = useState("");
  const [topupAmount, setTopupAmount] = useState("");
  const runTopup = useServerFn(bazikTopupWallet);

  const list = wallets ?? [];

  const createWallet = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("ensure_wallet", { _currency: newCurrency });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Billetera en ${newCurrency} lista`);
    refresh();
  };

  const convert = async () => {
    const value = Number(amount);
    if (!fromWallet || !Number.isFinite(value) || value <= 0) {
      toast.error("Elige una billetera y un monto válido");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("convert_wallet", {
      _from_wallet: fromWallet,
      _to_currency: toCurrency,
      _amount: value,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Conversión realizada");
    setAmount("");
    refresh();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Billetera</h1>
        <p className="text-sm text-muted-foreground">
          Guarda saldo en varias monedas, conviértelo y úsalo con tu tarjeta virtual.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {!isLoading && list.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aún no tienes billeteras. Crea la primera abajo.
          </p>
        )}
        {list.map((w) => (
          <Card key={w.id}>
            <CardContent className="space-y-1 p-5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <WalletIcon className="size-4" /> {w.currency}
                </span>
                <Badge variant={w.status === "active" ? "secondary" : "outline"}>
                  {w.status === "active" ? "Activa" : w.status}
                </Badge>
              </div>
              <p className="font-display text-2xl font-semibold">
                {money(Number(w.balance), w.currency)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="size-4" /> Nueva billetera
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label>Moneda</Label>
            <Select value={newCurrency} onValueChange={setNewCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WALLET_CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button className="w-full" disabled={busy} onClick={createWallet}>
              Crear billetera
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowLeftRight className="size-4" /> Convertir saldo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Desde</Label>
                <Select value={fromWallet} onValueChange={setFromWallet}>
                  <SelectTrigger>
                    <SelectValue placeholder="Billetera" />
                  </SelectTrigger>
                  <SelectContent>
                    {list.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.currency} · {money(Number(w.balance), w.currency)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Hacia</Label>
                <Select value={toCurrency} onValueChange={setToCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WALLET_CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="conv-amount">Monto</Label>
              <Input
                id="conv-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <Button className="w-full" disabled={busy} onClick={convert}>
              Convertir
            </Button>
            <p className="text-xs text-muted-foreground">
              Se usa el tipo de cambio vigente configurado por administración.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movimientos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(movements ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Todavía no hay movimientos.</p>
          )}
          {(movements ?? []).map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between border-b py-2 last:border-0"
            >
              <div>
                <p className="text-sm font-medium">{KIND_LABEL[m.kind] ?? m.kind}</p>
                <p className="text-xs text-muted-foreground">
                  {m.description ? `${m.description} · ` : ""}
                  {shortDate(m.created_at)}
                </p>
              </div>
              <p
                className={
                  Number(m.amount) < 0 ? "text-sm font-semibold text-destructive" : "text-sm font-semibold text-success"
                }
              >
                {money(Number(m.amount), m.currency)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
