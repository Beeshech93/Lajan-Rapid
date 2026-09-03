import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Smartphone, Send, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCountries } from "@/hooks/useCorridors";
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
import {
  dingCreateTopupCheckout,
  dingListProducts,
  dingSendTopup,
} from "@/lib/dingconnect.functions";
import type { OxxoVoucher, SpeiReference } from "@/lib/mercadopago.server";
import { money, paymentMethods, paymentLabel, shortDate } from "@/lib/remesa";
import { TOPUP_COUNTRIES, findTopupCountry, prettyOperator } from "@/lib/topup-operators";
import { validatePhone, formatNational, expectedLengths, normalizeLocal } from "@/lib/phone";

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

function Recargas() {
  const qc = useQueryClient();
  const refreshWallet = useRefreshWallet();
  const { data: wallets } = useWallets();
  const { data: countries } = useCountries();
  const listProducts = useServerFn(dingListProducts);
  const sendTopup = useServerFn(dingSendTopup);
  const createCheckout = useServerFn(dingCreateTopupCheckout);

  const [country, setCountry] = useState("HT");
  const [operator, setOperator] = useState("");
  const [sku, setSku] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [payOrigin, setPayOrigin] = useState("MX");
  const [payMethod, setPayMethod] = useState("wallet");
  const [pendingResult, setPendingResult] = useState<
    { mode: "voucher"; voucher: OxxoVoucher } | { mode: "spei"; spei: SpeiReference } | null
  >(null);

  const payOrigins = (countries ?? []).filter((c) => c.is_origin);
  const payMethods = useMemo(
    () => [
      { value: "wallet", label: "Saldo de mi billetera", hint: "Instantáneo" },
      ...paymentMethods(payOrigin),
    ],
    [payOrigin],
  );

  // Usar la primera billetera disponible como defecto
  const wallet = useMemo(() => (wallets ?? [])[0], [wallets]);
  const walletId = wallet?.id ?? "";

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

      if (payMethod === "wallet") {
        return {
          kind: "wallet" as const,
          result: await sendTopup({
            data: {
              walletId,
              skuCode: sku || operator,
              operator,
              countryCode: country,
              phone: phoneCheck.e164,
              amount: value,
            },
          }),
        };
      }

      const originInfo = payOrigins.find((c) => c.code === payOrigin);
      return {
        kind: "checkout" as const,
        result: await createCheckout({
          data: {
            skuCode: sku || operator,
            operator,
            countryCode: country,
            phone: phoneCheck.e164,
            amount: value,
            currency: originInfo?.currency ?? "USD",
            paymentMethod: payMethod,
            originCountry: payOrigin,
          },
        }),
      };
    },
    onSuccess: (r) => {
      if (r.kind === "wallet") {
        toast.success(`Recarga enviada · ${r.result.reference}`);
        setPhone("");
        setAmount("");
        refreshWallet();
        void qc.invalidateQueries({ queryKey: ["topups"] });
        return;
      }

      if (r.result.mode === "checkout") {
        window.location.href = r.result.checkoutUrl;
        return;
      }

      setPendingResult(r.result);
      setPhone("");
      setAmount("");
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
            <Label>País desde donde pagas</Label>
            <Select
              value={payOrigin}
              onValueChange={(v) => {
                setPayOrigin(v);
                setPayMethod("wallet");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {payOrigins.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name ?? c.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Método de pago</Label>
            <Select value={payMethod} onValueChange={setPayMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {payMethods.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.value === "wallet" ? m.label : paymentLabel(m.value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
                    {p.minValue != null ? `${p.minValue} – ${p.maxValue} ${p.currency}` : p.skuCode}
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
            <Label htmlFor="tu-amount">Monto {wallet ? `(${wallet.currency})` : ""}</Label>
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
              {sendMut.isPending
                ? "Enviando..."
                : payMethod === "wallet"
                  ? "Enviar recarga"
                  : payMethod === "oxxo"
                    ? "Generar ficha OXXO"
                    : payMethod === "spei"
                      ? "Generar CLABE SPEI"
                      : "Pagar con tarjeta"}
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              {payMethod === "wallet"
                ? "El monto se descuenta de tu billetera. Si el operador rechaza la recarga, el saldo se devuelve automáticamente y recibes una notificación."
                : "Se te pedirá completar el pago; la recarga se envía automáticamente en cuanto se confirme."}
            </p>
          </div>
        </CardContent>
      </Card>

      {pendingResult?.mode === "voucher" && (
        <Card className="border-accent/40">
          <CardHeader>
            <CardTitle className="text-base">Ficha de pago en OXXO</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl bg-secondary p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Referencia OXXO
              </p>
              <p className="mt-1 break-all font-display text-2xl font-bold tracking-wider">
                {pendingResult.voucher.reference}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => {
                  void navigator.clipboard.writeText(pendingResult.voucher.reference);
                  toast.success("Referencia copiada");
                }}
              >
                <Copy className="size-4" /> Copiar referencia
              </Button>
              {pendingResult.voucher.voucherUrl && (
                <Button size="sm" className="gap-2" asChild>
                  <a href={pendingResult.voucher.voucherUrl} target="_blank" rel="noreferrer">
                    Ver comprobante
                  </a>
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Muestra esta referencia en cualquier tienda OXXO. La recarga se envía automáticamente
              en cuanto se confirme el pago.
            </p>
          </CardContent>
        </Card>
      )}

      {pendingResult?.mode === "spei" && (
        <Card className="border-accent/40">
          <CardHeader>
            <CardTitle className="text-base">Transferencia SPEI</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl bg-secondary p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">CLABE</p>
              <p className="mt-1 break-all font-display text-2xl font-bold tracking-wider">
                {pendingResult.spei.clabe}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => {
                void navigator.clipboard.writeText(pendingResult.spei.clabe);
                toast.success("CLABE copiada");
              }}
            >
              <Copy className="size-4" /> Copiar CLABE
            </Button>
            <p className="text-xs text-muted-foreground">
              Transfiere desde tu banco a esta CLABE. La recarga se envía automáticamente en cuanto
              se confirme el pago.
            </p>
          </CardContent>
        </Card>
      )}

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
