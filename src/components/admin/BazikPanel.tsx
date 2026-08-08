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

const CRED_KEYS = [
  "BAZIK_BASE_URL",
  "BAZIK_COLLECT_API_KEY",
  "BAZIK_COLLECT_API_SECRET",
  "BAZIK_PAYOUT_API_KEY",
  "BAZIK_PAYOUT_API_SECRET",
] as const;
type CredKey = (typeof CRED_KEYS)[number];

export function BazikPanel() {
  const status = useServerFn(bazikStatus);
  const topup = useServerFn(bazikTopupWallet);
  const payout = useServerFn(bazikSendMobileMoney);
  const saveCreds = useServerFn(bazikSaveCredentials);
  const queryClient = useQueryClient();

  const { data: info } = useQuery({
    queryKey: ["bazik_status"],
    queryFn: () => status(),
  });

  const [creds, setCreds] = useState<Record<CredKey, string>>({
    BAZIK_BASE_URL: "",
    BAZIK_COLLECT_API_KEY: "",
    BAZIK_COLLECT_API_SECRET: "",
    BAZIK_PAYOUT_API_KEY: "",
    BAZIK_PAYOUT_API_SECRET: "",
  });
  const setCred = (k: CredKey, v: string) => setCreds((p) => ({ ...p, [k]: v }));

  const saveMut = useMutation({
    mutationFn: () => {
      const payloadEntries = CRED_KEYS.filter((k) => creds[k].trim().length > 0).map(
        (k) => [k, creds[k].trim()] as const,
      );
      if (payloadEntries.length === 0) throw new Error("Nada que guardar");
      return saveCreds({ data: Object.fromEntries(payloadEntries) });
    },
    onSuccess: () => {
      toast.success("Credenciales guardadas");
      setCreds({
        BAZIK_BASE_URL: "",
        BAZIK_COLLECT_API_KEY: "",
        BAZIK_COLLECT_API_SECRET: "",
        BAZIK_PAYOUT_API_KEY: "",
        BAZIK_PAYOUT_API_SECRET: "",
      });
      void queryClient.invalidateQueries({ queryKey: ["bazik_status"] });
    },
    onError: (e: Error) => toast.error(e.message),
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
            Pega aquí las credenciales de tus dos APIs de Bazik. Se guardan cifradas en el backend
            y nunca se muestran de vuelta.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="bazik-base">URL base (opcional)</Label>
            <Input
              id="bazik-base"
              value={creds.BAZIK_BASE_URL}
              onChange={(e) => setCred("BAZIK_BASE_URL", e.target.value)}
              placeholder={info?.baseUrl ?? "https://api.bazik.io"}
            />
          </div>

          {[
            { api: info?.collect, n: 1, k: "BAZIK_COLLECT_API_KEY", s: "BAZIK_COLLECT_API_SECRET" },
            { api: info?.payout, n: 2, k: "BAZIK_PAYOUT_API_KEY", s: "BAZIK_PAYOUT_API_SECRET" },
          ].map(({ api, n, k, s }) => (
            <div key={k} className="space-y-3 rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  API {n} ·{" "}
                  {api?.label ??
                    (n === 1 ? "API de cobros (recargar billetera)" : "API de envíos (MonCash / NatCash)")}
                </span>
                <Badge variant={api?.hasKey ? "secondary" : "destructive"}>
                  {api?.hasKey ? "Key activa" : "Falta Key"}
                </Badge>
                <Badge variant={api?.hasSecret ? "secondary" : "outline"}>
                  {api?.hasSecret ? "Secret activo" : "Sin Secret"}
                </Badge>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={k}>API Key</Label>
                <Input
                  id={k}
                  type="password"
                  autoComplete="off"
                  value={creds[k as CredKey]}
                  onChange={(e) => setCred(k as CredKey, e.target.value)}
                  placeholder="pegar aquí"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={s}>API Secret</Label>
                <Input
                  id={s}
                  type="password"
                  autoComplete="off"
                  value={creds[s as CredKey]}
                  onChange={(e) => setCred(s as CredKey, e.target.value)}
                  placeholder="pegar aquí"
                />
              </div>
              {api ? <CopyField label="Endpoint saliente" value={api.endpoint} /> : null}
            </div>
          ))}

          <Button
            className="w-full"
            disabled={saveMut.isPending}
            onClick={() => saveMut.mutate()}
          >
            <Save className="mr-2 size-4" /> Guardar credenciales
          </Button>
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
