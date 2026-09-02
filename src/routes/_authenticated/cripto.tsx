import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine, Copy, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { money, shortDate } from "@/lib/remesa";
import { useWallets, useWalletTransactions, useRefreshWallet } from "@/hooks/useWallet";
import {
  useCryptoAssets,
  useCryptoDeposits,
  useCryptoWithdrawals,
  useRefreshCrypto,
} from "@/hooks/useCrypto";

export const Route = createFileRoute("/_authenticated/cripto")({
  head: () => ({
    meta: [
      { title: "Cripto — Lajan Rapid" },
      {
        name: "description",
        content:
          "Recibe USDT, Bitcoin y USDC, conviértelos en gourdes y retira por MonCash o NatCash.",
      },
      { property: "og:title", content: "Cripto — Lajan Rapid" },
      {
        property: "og:description",
        content: "Depósitos cripto convertidos a gourdes y retiros MonCash / NatCash.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Cripto,
});

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  processing: "En proceso",
  approved: "Acreditado",
  completed: "Completado",
  rejected: "Rechazado",
};

const KIND_LABEL: Record<string, string> = {
  moncash: "MonCash",
  natcash: "NatCash",
  crypto: "Dirección cripto",
};

function Cripto() {
  const { data: assets } = useCryptoAssets();
  const { data: wallets } = useWallets();
  const { data: movements } = useWalletTransactions();
  const { data: deposits } = useCryptoDeposits();
  const { data: withdrawals } = useCryptoWithdrawals();
  const refreshCrypto = useRefreshCrypto();
  const refreshWallet = useRefreshWallet();

  const [assetId, setAssetId] = useState("");
  const [depAmount, setDepAmount] = useState("");
  const [txHash, setTxHash] = useState("");
  const [busy, setBusy] = useState(false);

  const [wKind, setWKind] = useState("moncash");
  const [wAssetId, setWAssetId] = useState("");
  const [wDestination, setWDestination] = useState("");
  const [wAmount, setWAmount] = useState("");

  const list = assets ?? [];
  const asset = list.find((a) => a.id === assetId) ?? list[0];
  const wAsset = list.find((a) => a.id === wAssetId);
  const htg = (wallets ?? []).find((w) => w.currency === "HTG");
  const balance = Number(htg?.balance ?? 0);

  const estimate = useMemo(() => {
    const value = Number(depAmount);
    if (!asset || !Number.isFinite(value) || value <= 0) return 0;
    return value * Number(asset.htg_rate) * (1 - Number(asset.fee_percent) / 100);
  }, [asset, depAmount]);

  const wEstimate = useMemo(() => {
    const value = Number(wAmount);
    if (wKind !== "crypto" || !wAsset || !Number.isFinite(value) || value <= 0) return 0;
    return (value / Number(wAsset.htg_rate)) * (1 - Number(wAsset.fee_percent) / 100);
  }, [wKind, wAsset, wAmount]);

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Copiado");
  };

  const submitDeposit = async () => {
    const value = Number(depAmount);
    if (!asset || !Number.isFinite(value) || value <= 0 || txHash.trim().length < 6) {
      toast.error("Elige la cripto, el monto y pega el hash de la transacción");
      return;
    }
    if (value < Number(asset.min_deposit)) {
      toast.error(`El mínimo es ${asset.min_deposit} ${asset.code}`);
      return;
    }
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("crypto_deposits").insert({
      user_id: auth.user!.id,
      asset_id: asset.id,
      amount_crypto: value,
      tx_hash: txHash.trim(),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Comprobante enviado. Acreditamos tu saldo tras verificarlo.");
    setDepAmount("");
    setTxHash("");
    refreshCrypto();
  };

  const submitWithdrawal = async () => {
    const value = Number(wAmount);
    if (!Number.isFinite(value) || value <= 0 || !wDestination.trim()) {
      toast.error("Indica destino y monto válido");
      return;
    }
    if (wKind === "crypto" && !wAssetId) {
      toast.error("Elige la cripto a enviar");
      return;
    }
    if (value > balance) {
      toast.error("Saldo insuficiente en gourdes");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("request_crypto_withdrawal", {
      _kind: wKind,
      _destination: wDestination.trim(),
      _amount_htg: value,
      ...(wKind === "crypto" ? { _asset_id: wAssetId } : {}),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Retiro solicitado");
    setWAmount("");
    setWDestination("");
    refreshCrypto();
    refreshWallet();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Cripto</h1>
        <p className="text-sm text-muted-foreground">
          Recibe cripto, conviértelo en gourdes y retira por MonCash o NatCash.
        </p>
      </div>

      <Card className="bg-brand text-primary-foreground">
        <CardContent className="flex items-center justify-between p-5">
          <div>
            <p className="text-xs opacity-80">Saldo disponible</p>
            <p className="font-display text-3xl font-bold">{money(balance, "HTG")}</p>
          </div>
          <Coins className="size-10 opacity-80" />
        </CardContent>
      </Card>

      <Tabs defaultValue="recibir">
        <TabsList className="w-full">
          <TabsTrigger value="recibir" className="flex-1">
            Recibir
          </TabsTrigger>
          <TabsTrigger value="retirar" className="flex-1">
            Retirar
          </TabsTrigger>
          <TabsTrigger value="movimientos" className="flex-1">
            Movimientos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recibir" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowDownToLine className="size-4" /> Depositar cripto
              </CardTitle>
              <CardDescription>
                Envía a la dirección de la red correcta y sube el hash de tu transacción.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Criptomoneda</Label>
                <Select value={asset?.id ?? ""} onValueChange={setAssetId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Elige una cripto" />
                  </SelectTrigger>
                  <SelectContent>
                    {list.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.code} · {a.network}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {asset && (
                <div className="rounded-xl border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">
                    Dirección de depósito ({asset.network})
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate text-sm">
                      {asset.deposit_address || "Aún no configurada — contacta soporte"}
                    </code>
                    {asset.deposit_address && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => copy(asset.deposit_address)}
                      >
                        <Copy className="size-4" />
                      </Button>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Tasa: 1 {asset.code} = {Number(asset.htg_rate).toLocaleString("es-MX")} HTG ·
                    Comisión {asset.fee_percent}% · Mínimo {asset.min_deposit} {asset.code}
                  </p>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Monto enviado</Label>
                  <Input
                    inputMode="decimal"
                    placeholder="0.00"
                    value={depAmount}
                    onChange={(e) => setDepAmount(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Hash de la transacción</Label>
                  <Input
                    placeholder="0x… / TRX…"
                    value={txHash}
                    onChange={(e) => setTxHash(e.target.value)}
                  />
                </div>
              </div>

              {estimate > 0 && (
                <p className="text-sm text-muted-foreground">
                  Recibirás aproximadamente{" "}
                  <span className="font-semibold text-foreground">{money(estimate, "HTG")}</span>
                </p>
              )}

              <Button className="w-full" disabled={busy} onClick={submitDeposit}>
                Enviar comprobante
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mis depósitos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(deposits ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Sin depósitos todavía.</p>
              )}
              {(deposits ?? []).map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between border-b py-2 text-sm last:border-0"
                >
                  <div>
                    <p className="font-medium">
                      {d.amount_crypto} · {d.reference}
                    </p>
                    <p className="text-xs text-muted-foreground">{shortDate(d.created_at)}</p>
                  </div>
                  <div className="text-right">
                    {d.status === "approved" && (
                      <p className="font-semibold">{money(Number(d.amount_htg), "HTG")}</p>
                    )}
                    <Badge variant={d.status === "rejected" ? "destructive" : "secondary"}>
                      {STATUS_LABEL[d.status] ?? d.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="retirar" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowUpFromLine className="size-4" /> Retirar saldo
              </CardTitle>
              <CardDescription>
                Cobra en MonCash o NatCash, o envía cripto a una dirección externa.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Destino</Label>
                <Select value={wKind} onValueChange={setWKind}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="moncash">MonCash</SelectItem>
                    <SelectItem value="natcash">NatCash</SelectItem>
                    <SelectItem value="crypto">Dirección cripto externa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {wKind === "crypto" && (
                <div>
                  <Label>Criptomoneda</Label>
                  <Select value={wAssetId} onValueChange={setWAssetId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Elige una cripto" />
                    </SelectTrigger>
                    <SelectContent>
                      {list.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.code} · {a.network}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>{wKind === "crypto" ? "Dirección de destino" : "Número de teléfono"}</Label>
                <Input
                  placeholder={wKind === "crypto" ? "Dirección de la wallet" : "+509…"}
                  value={wDestination}
                  onChange={(e) => setWDestination(e.target.value)}
                />
              </div>

              <div>
                <Label>Monto en gourdes</Label>
                <Input
                  inputMode="decimal"
                  placeholder="0.00"
                  value={wAmount}
                  onChange={(e) => setWAmount(e.target.value)}
                />
              </div>

              {wEstimate > 0 && wAsset && (
                <p className="text-sm text-muted-foreground">
                  Enviaremos ≈{" "}
                  <span className="font-semibold text-foreground">
                    {wEstimate.toFixed(6)} {wAsset.code}
                  </span>{" "}
                  por {wAsset.network}
                </p>
              )}

              <Button className="w-full" disabled={busy} onClick={submitWithdrawal}>
                Solicitar retiro
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mis retiros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(withdrawals ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Sin retiros todavía.</p>
              )}
              {(withdrawals ?? []).map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between border-b py-2 text-sm last:border-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {KIND_LABEL[w.kind] ?? w.kind} · {w.reference}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {w.destination} · {shortDate(w.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{money(Number(w.amount_htg), "HTG")}</p>
                    <Badge variant={w.status === "rejected" ? "destructive" : "secondary"}>
                      {STATUS_LABEL[w.status] ?? w.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movimientos" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Movimientos de saldo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(movements ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Sin movimientos.</p>
              )}
              {(movements ?? []).map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between border-b py-2 text-sm last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m.description ?? m.kind}</p>
                    <p className="text-xs text-muted-foreground">{shortDate(m.created_at)}</p>
                  </div>
                  <p
                    className={
                      Number(m.amount) >= 0 ? "font-semibold text-success" : "font-semibold"
                    }
                  >
                    {money(Number(m.amount), m.currency)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
