import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Link2, PlugZap, Send } from "lucide-react";
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
import {
  bazikSendMobileMoney,
  bazikStatus,
  bazikTopupWallet,
} from "@/lib/bazik.functions";

export function BazikPanel() {
  const status = useServerFn(bazikStatus);
  const topup = useServerFn(bazikTopupWallet);
  const payout = useServerFn(bazikSendMobileMoney);

  const { data: info } = useQuery({
    queryKey: ["bazik_status"],
    queryFn: () => status(),
  });

  const [walletId, setWalletId] = useState("");
  const [topAmount, setTopAmount] = useState("");
  const [topCurrency, setTopCurrency] = useState("HTG");

  const [provider, setProvider] = useState<"moncash" | "natcash">("moncash");
  const [phone, setPhone] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payCurrency, setPayCurrency] = useState("HTG");

  const topupMut = useMutation({
    mutationFn: () =>
      topup({
        data: { walletId, amount: Number(topAmount), currency: topCurrency as "HTG" },
      }),
    onSuccess: (r) =>
      r.ok
        ? toast.success(`Recarga enviada · ${r.reference}`)
        : toast.error(r.error ?? "No se pudo recargar"),
    onError: (e: Error) => toast.error(e.message),
  });

  const payoutMut = useMutation({
    mutationFn: () =>
      payout({
        data: { provider, phone, amount: Number(payAmount), currency: payCurrency as "HTG" },
      }),
    onSuccess: (r) =>
      r.ok
        ? toast.success(`Envío enviado · ${r.reference}`)
        : toast.error(r.error ?? "No se pudo enviar"),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PlugZap className="size-4" /> Conexión Bazik (bazik.io)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant={info?.configured ? "secondary" : "destructive"}>
              {info?.configured ? "Credencial activa" : "Falta BAZIK_API_KEY"}
            </Badge>
            <span className="text-xs text-muted-foreground">{info?.baseUrl}</span>
          </div>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link2 className="size-3" /> Recarga: {info?.topupEndpoint}
          </p>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link2 className="size-3" /> Envío MonCash/NatCash: {info?.payoutEndpoint}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Atento 1 · Recargar billetera</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="bazik-wallet">ID de billetera</Label>
            <Input
              id="bazik-wallet"
              value={walletId}
              onChange={(e) => setWalletId(e.target.value)}
              placeholder="uuid de la billetera"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bazik-top-amount">Monto</Label>
              <Input
                id="bazik-top-amount"
                inputMode="decimal"
                value={topAmount}
                onChange={(e) => setTopAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Moneda</Label>
              <Select value={topCurrency} onValueChange={setTopCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["HTG", "USD", "MXN", "DOP", "EUR"].map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            className="w-full"
            disabled={topupMut.isPending}
            onClick={() => topupMut.mutate()}
          >
            Ejecutar recarga
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="size-4" /> Atento 2 · Enviar a MonCash / NatCash
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Proveedor</Label>
              <Select
                value={provider}
                onValueChange={(v) => setProvider(v as "moncash" | "natcash")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="moncash">MonCash</SelectItem>
                  <SelectItem value="natcash">NatCash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bazik-phone">Teléfono destino</Label>
              <Input
                id="bazik-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+509 3xxx xxxx"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bazik-pay-amount">Monto</Label>
              <Input
                id="bazik-pay-amount"
                inputMode="decimal"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Moneda</Label>
              <Select value={payCurrency} onValueChange={setPayCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HTG">HTG</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            className="w-full"
            disabled={payoutMut.isPending}
            onClick={() => payoutMut.mutate()}
          >
            Ejecutar envío
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
