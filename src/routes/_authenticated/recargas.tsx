import { createFileRoute, redirect } from "@tanstack/react-router";
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
import { TOPUP_COUNTRIES, findTopupCountry, prettyOperator } from "@/lib/topup-operators";
import { validatePhone, formatNational, expectedLengths, normalizeLocal } from "@/lib/phone";

export const Route = createFileRoute("/_authenticated/recargas")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
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


function Recargas() {
  const qc = useQueryClient();
  const refreshWallet = useRefreshWallet();
  const { data: wallets } = useWallets();
  const listProducts = useServerFn(dingListProducts);
  const sendTopup = useServerFn(dingSendTopup);

  const [country, setCountry] = useState("HT");
  const [walletId, setWalletId] = useState("");
  const [operator, setOperator] = useState("");
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

  const countryInfo = findTopupCountry(country);
  const dial = countryInfo?.dialCode ?? "+509";
  // DO/JM/PR usan +1 con 10 dígitos (código de área incluido), como US.
  const validationCode = ["DO", "JM", "PR"].includes(country) ? "US" : country;

  const phoneCheck = useMemo(
    () => validatePhone(validationCode, dial, phone),
    [validationCode, dial, phone],
  );
  const phoneDigits = normalizeLocal(phone, dial);
  const lengths = expectedLengths(validationCode);
  const phoneError =
    phone.trim() === "" || phoneCheck.ok
      ? null
      : phoneCheck.error === "short"
        ? `Faltan dígitos: ${countryInfo?.label ?? country} usa ${lengths.join(" o ")} dígitos (llevas ${phoneDigits.length}).`
        : phoneCheck.error === "long"
          ? `Sobran dígitos: ${countryInfo?.label ?? country} usa ${lengths.join(" o ")} dígitos (llevas ${phoneDigits.length}).`
          : `Número inválido para ${countryInfo?.label ?? country}. Debe tener ${lengths.join(" o ")} dígitos.`;


  // Operadores del país: del catálogo del proveedor si hay, si no del catálogo local.
  const operators = useMemo(() => {
    const items = products?.items ?? [];
    const fromProvider = Array.from(
      new Set(items.map((p) => prettyOperator(country, p.operator || p.skuCode))),
    ).filter(Boolean);
    return fromProvider.length > 0 ? fromProvider : (countryInfo?.operators ?? []);
  }, [products, country, countryInfo]);

  // Planes/SKUs del operador elegido.
  const plans = useMemo(
    () =>
      (products?.items ?? []).filter(
        (p) => prettyOperator(country, p.operator || p.skuCode) === operator,
      ),
    [products, country, operator],
  );

  const selected = (products?.items ?? []).find((p) => p.skuCode === sku);

  const sendMut = useMutation({
    mutationFn: async () => {
      if (!walletId) throw new Error("Elige la billetera de origen");
      if (!operator) throw new Error("Elige el operador");
      if (!sku && plans.length > 0) throw new Error("Elige el plan del operador");
      if (!phone.trim()) throw new Error("Escribe el número a recargar");
      if (!phoneCheck.ok || !phoneCheck.e164)
        throw new Error(phoneError ?? "Número de teléfono inválido");
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) throw new Error("Monto inválido");
      if (
        selected?.minValue != null &&
        (value < Number(selected.minValue) || value > Number(selected.maxValue))
      )
        throw new Error(
          `El monto debe estar entre ${selected.minValue} y ${selected.maxValue} ${selected.currency}`,
        );
      return sendTopup({
        data: {
          walletId,
          skuCode: sku || operator,
          operator,
          countryCode: country,
          phone: phoneCheck.e164,
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
                setOperator("");
                setSku("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOPUP_COUNTRIES.map((c) => (
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

          <div className="space-y-1.5">
            <Label>Operador de {countryInfo?.label ?? country}</Label>
            <Select
              value={operator}
              onValueChange={(v) => {
                setOperator(v);
                setSku("");
              }}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={isFetching ? "Cargando operadores..." : "Elige el operador"}
                />
              </SelectTrigger>
              <SelectContent>
                {operators.map((op) => (
                  <SelectItem key={op} value={op}>
                    {op}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {products && !products.ok && (
              <p className="text-xs text-muted-foreground">
                Mostrando los operadores habituales de este país. Un administrador debe configurar
                DingConnect para ver los planes exactos.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Plan</Label>
            <Select value={sku} onValueChange={setSku} disabled={plans.length === 0}>
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    !operator
                      ? "Elige primero el operador"
                      : plans.length === 0
                        ? "Monto libre"
                        : "Elige el plan"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.skuCode} value={p.skuCode}>
                    {p.minValue != null
                      ? `${p.minValue} – ${p.maxValue} ${p.currency}`
                      : p.skuCode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tu-phone">Número a recargar</Label>
            <div className="flex items-center gap-2">
              <span className="rounded-md border bg-muted px-2.5 py-2 text-sm text-muted-foreground">
                {dial}
              </span>
              <Input
                id="tu-phone"
                inputMode="tel"
                autoComplete="tel"
                maxLength={24}
                aria-invalid={phoneError ? true : undefined}
                placeholder={countryInfo?.placeholder ?? "+509 3412 3456"}
                value={phone}
                onChange={(e) => setPhone(formatNational(validationCode, e.target.value, dial))}
              />
            </div>
            {phoneError ? (
              <p className="text-xs text-destructive">{phoneError}</p>
            ) : phoneCheck.ok ? (
              <p className="text-xs text-muted-foreground">Se enviará a {phoneCheck.e164}</p>
            ) : lengths.length ? (
              <p className="text-xs text-muted-foreground">
                {lengths.join(" o ")} dígitos para {countryInfo?.label ?? country}
              </p>
            ) : null}
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
              disabled={sendMut.isPending || !phoneCheck.ok}
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
