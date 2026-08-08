import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Link2, PlugZap, Send } from "lucide-react";
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

function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs" />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Copiar ${label}`}
          onClick={() => {
            void navigator.clipboard.writeText(value);
            toast.success("Copiado");
          }}
        >
          <Copy className="size-4" />
        </Button>
      </div>
    </div>
  );
}

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

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PlugZap className="size-4" /> Credenciales Bazik (bazik.io)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-xs text-muted-foreground">
            Dos APIs separadas. Guarda cada Key y Secret en el formulario seguro del proyecto
            (Ajustes → Secretos) con los nombres exactos de abajo.
          </p>

          {[info?.collect, info?.payout].map((api, i) =>
            api ? (
              <div key={api.keyName} className="space-y-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    API {i + 1} · {api.label}
                  </span>
                  <Badge variant={api.hasKey ? "secondary" : "destructive"}>
                    {api.hasKey ? "Key activa" : "Falta Key"}
                  </Badge>
                  <Badge variant={api.hasSecret ? "secondary" : "outline"}>
                    {api.hasSecret ? "Secret activo" : "Sin Secret"}
                  </Badge>
                </div>
                <CopyField label="Nombre de la Key" value={api.keyName} />
                <CopyField label="Nombre del Secret" value={api.secretName} />
                <CopyField label="Endpoint saliente" value={api.endpoint} />
              </div>
            ) : null,
          )}
          <p className="text-xs text-muted-foreground">Base: {info?.baseUrl}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="size-4" /> Atentos para pegar en bazik.io
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Copia estas dos URLs y pégalas como webhooks/callbacks en tu panel de bazik.io.
          </p>
          <CopyField
            label="Atento 1 · Recarga de billetera (cobros)"
            value={`${origin}/api/public/bazik/topup`}
          />
          <CopyField
            label="Atento 2 · Envío MonCash / NatCash"
            value={`${origin}/api/public/bazik/payout`}
          />
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
