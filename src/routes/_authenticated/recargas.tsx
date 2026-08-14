import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Smartphone, Send } from "lucide-react";
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
import { useWallets, useRefreshWallet } from "@/hooks/useWallet";
import { dingListProducts, dingSendTopup } from "@/lib/dingconnect.functions";
import { money, shortDate } from "@/lib/remesa";

export const Route = createFileRoute("/_authenticated/recargas")({
  head: () => ({
    meta: [
      { title: "Recargas de saldo móvil — Lajan Rapid" },
      {
        name: "description",
        content:
          "Envía recargas de saldo móvil a Haití y otros países desde tu billetera Lajan Rapid.",
      },
      { property: "og:title", content: "Recargas de saldo móvil — Lajan Rapid" },
      {
        property: "og:description",
        content: "Top-up internacional instantáneo desde tu billetera.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Recargas,
});

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  processing: "En proceso",
  completed: "Completada",
  failed: "Fallida",
  refunded: "Devuelta",
};

const COUNTRIES = [
  { code: "HT", label: "🇭🇹 Haití" },
  { code: "DO", label: "🇩🇴 República Dominicana" },
  { code: "MX", label: "🇲🇽 México" },
  { code: "US", label: "🇺🇸 Estados Unidos" },
];

function Recargas() {
  const qc = useQueryClient();
  const refreshWallet = useRefreshWallet();
  const { data: wallets } = useWallets();
  const listProducts = useServerFn(dingListProducts);
  const sendTopup = useServerFn(dingSendTopup);

  const [country, setCountry] = useState("HT");
  const [walletId, setWalletId] = useState("");
  const [sku, setSku] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");

  const wallet = useMemo(
    () => (wallets ?? []).find((w) => w.id === walletId),
    [wallets, walletId],
  );

  const { data: products, isFetching } = useQuery({
    queryKey: ["ding_products", country],
    queryFn: () => listProducts({ data: { countryCode: country } }),
  });

  const { data: topups } = useQuery({
    queryKey: ["topups"],
    queryFn: async () => {
      const { data } = await supabase
        .from("topups")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
  });

  const selected = (products?.items ?? []).find((p) => p.skuCode === sku);

  const sendMut = useMutation({
    mutationFn: async () => {
      if (!walletId) throw new Error("Elige la billetera de origen");
      if (!sku) throw new Error("Elige el operador");
      if (!phone.trim()) throw new Error("Escribe el número a recargar");
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) throw new Error("Monto inválido");
      return sendTopup({
        data: {
          walletId,
          skuCode: sku,
          operator: selected?.operator ?? "",
          countryCode: country,
          phone: phone.trim(),
          amount: value,
        },
      });
    },
    onSuccess: (r) => {
      toast.success(`Recarga enviada · ${r.reference}`);
      setPhone("");
      setAmount("");
      refreshWallet();
      void qc.invalidateQueries({ queryKey: ["topups"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <h1 className="text-2xl font-bold">Recargas de saldo móvil</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="size-4" /> Enviar recarga
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>País del número</Label>
            <Select
              value={country}
              onValueChange={(v) => {
                setCountry(v);
                setSku("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Billetera de origen</Label>
            <Select value={walletId} onValueChange={setWalletId}>
              <SelectTrigger>
                <SelectValue placeholder="Elige una billetera" />
              </SelectTrigger>
              <SelectContent>
                {(wallets ?? []).map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.currency} · {money(Number(w.balance), w.currency)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Operador</Label>
            <Select value={sku} onValueChange={setSku}>
              <SelectTrigger>
                <SelectValue
                  placeholder={isFetching ? "Cargando operadores..." : "Elige el operador"}
                />
              </SelectTrigger>
              <SelectContent>
                {(products?.items ?? []).map((p) => (
                  <SelectItem key={p.skuCode} value={p.skuCode}>
                    {p.operator || p.skuCode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {products && !products.ok && (
              <p className="text-xs text-muted-foreground">
                No se pudo cargar el catálogo del proveedor. Un administrador debe configurar
                DingConnect.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tu-phone">Número a recargar</Label>
            <Input
              id="tu-phone"
              placeholder="+509 1234 5678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tu-amount">
              Monto {wallet ? `(${wallet.currency})` : ""}
            </Label>
            <Input
              id="tu-amount"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {selected?.minValue != null && (
              <p className="text-xs text-muted-foreground">
                Rango del operador: {selected.minValue} – {selected.maxValue} {selected.currency}
              </p>
            )}
          </div>

          <div className="sm:col-span-2">
            <Button
              className="w-full"
              disabled={sendMut.isPending}
              onClick={() => sendMut.mutate()}
            >
              <Send className="mr-2 size-4" />
              {sendMut.isPending ? "Enviando..." : "Enviar recarga"}
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              El monto se descuenta de tu billetera. Si el operador rechaza la recarga, el saldo se
              devuelve automáticamente y recibes una notificación.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de recargas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(topups ?? []).length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">Todavía no hiciste recargas.</p>
          )}
          {(topups ?? []).map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-lg border p-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  {t.operator || t.sku_code} · {t.phone}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.reference} · {shortDate(t.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold">{money(Number(t.amount), t.currency)}</span>
                <Badge variant={t.status === "completed" ? "default" : "secondary"}>
                  {STATUS_LABEL[t.status] ?? t.status}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
