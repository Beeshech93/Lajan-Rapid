import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { celebrateLogo } from "@/components/LogoAnimation";
import { Smartphone, Send, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCountries, useRate } from "@/hooks/useCorridors";
import { useProfile } from "@/hooks/useProfile";
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
import { interpolate, useI18n } from "@/lib/i18n";

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

function Recargas() {
  const qc = useQueryClient();
  const refreshWallet = useRefreshWallet();
  const { profile } = useProfile();
  const { t } = useI18n();
  const STATUS_LABEL: Record<string, string> = {
    pending: t("topup.status_pending"),
    processing: t("topup.status_processing"),
    completed: t("topup.status_completed"),
    failed: t("topup.status_failed"),
    refunded: t("topup.status_refunded"),
  };
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
  const [payCurrency, setPayCurrency] = useState("");
  const [pendingResult, setPendingResult] = useState<
    | { mode: "voucher"; voucher: OxxoVoucher }
    | { mode: "spei"; spei: SpeiReference }
    | { mode: "checkout"; checkoutUrl: string }
    | null
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

  // Convierte el monto automáticamente cuando cambia el país o el método de
  // pago (por lo tanto la moneda con la que se paga), para que la cifra
  // escrita siga representando el mismo valor real.
  useEffect(() => {
    const originInfo = (countries ?? []).find((c) => c.is_origin && c.code === payOrigin);
    const nextCurrency =
      payMethod === "wallet" ? (wallet?.currency ?? "") : (originInfo?.currency ?? "");
    if (!nextCurrency || nextCurrency === payCurrency) return;

    const value = Number(amount);
    const hasAmount = amount.trim() !== "" && Number.isFinite(value) && value > 0;
    if (!payCurrency || !hasAmount) {
      setPayCurrency(nextCurrency);
      return;
    }

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("exchange_rates")
        .select("rate")
        .eq("is_active", true)
        .eq("from_currency", payCurrency)
        .eq("to_currency", nextCurrency)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (data?.rate) {
        const converted = Math.round(value * Number(data.rate) * 100) / 100;
        setAmount(String(converted));
        toast(`Monto convertido a ${nextCurrency}: ${converted}`);
      } else {
        setAmount("");
        toast(`Ahora pagas en ${nextCurrency}: vuelve a escribir el monto`);
      }
      setPayCurrency(nextCurrency);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payOrigin, payMethod, wallet?.currency, countries]);

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
        ? interpolate(t("topup.phone_short"), {
            country: countryInfo?.label ?? country,
            digits: lengths.join(" o "),
            have: phoneDigits.length,
          })
        : phoneCheck.error === "long"
          ? interpolate(t("topup.phone_long"), {
              country: countryInfo?.label ?? country,
              digits: lengths.join(" o "),
              have: phoneDigits.length,
            })
          : interpolate(t("topup.phone_invalid"), {
              country: countryInfo?.label ?? country,
              digits: lengths.join(" o "),
            });

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

  // Tasa manual (configurada en /admin) de la moneda de pago a la moneda del
  // operador, para calcular cuánto recibe realmente el destinatario.
  // Moneda real del destinatario: la del producto si DingConnect la trae,
  // si no, la del país de destino elegido (siempre la conocemos).
  const destinationCurrency = (countries ?? []).find(
    (c) => c.is_destination && c.code === country,
  )?.currency;
  const operatorCurrency = selected?.currency || destinationCurrency || "";
  const sameCurrency = !!payCurrency && !!operatorCurrency && payCurrency === operatorCurrency;
  const { data: topupRate } = useRate(
    sameCurrency ? undefined : payCurrency || undefined,
    sameCurrency ? undefined : operatorCurrency || undefined,
  );
  const amountValue = Number(amount);
  const hasAmount = amount.trim() !== "" && Number.isFinite(amountValue) && amountValue > 0;
  const receivedAmount = !hasAmount
    ? null
    : sameCurrency
      ? amountValue
      : topupRate
        ? Math.round(amountValue * Number(topupRate.rate) * 100) / 100
        : null;
  const receivedCurrency = operatorCurrency || payCurrency;
  const missingRate = Boolean(hasAmount && !sameCurrency && operatorCurrency && !topupRate);

  const sendMut = useMutation({
    mutationFn: async () => {
      if (profile?.kyc_status !== "approved") throw new Error(t("topup.err_kyc"));
      if (!operator) throw new Error(t("topup.err_operator"));
      if (!sku && plans.length > 0) throw new Error(t("topup.err_plan"));
      if (!phone.trim()) throw new Error(t("topup.err_phone_empty"));
      if (!phoneCheck.ok || !phoneCheck.e164)
        throw new Error(phoneError ?? t("topup.err_phone_invalid"));
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) throw new Error(t("topup.err_amount"));
      if (missingRate)
        throw new Error(
          interpolate(t("topup.err_no_rate"), { from: payCurrency, to: operatorCurrency }),
        );
      if (receivedAmount == null) throw new Error(t("topup.err_no_received"));
      if (
        selected?.minValue != null &&
        (receivedAmount < Number(selected.minValue) || receivedAmount > Number(selected.maxValue))
      )
        throw new Error(
          interpolate(t("topup.err_range"), {
            min: selected.minValue,
            max: selected.maxValue ?? selected.minValue,
            currency: selected.currency,
          }),
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
              topupAmount: receivedAmount,
              topupCurrency: receivedCurrency,
            },
          }),
        };
      }

      return {
        kind: "checkout" as const,
        result: await createCheckout({
          data: {
            skuCode: sku || operator,
            operator,
            countryCode: country,
            phone: phoneCheck.e164,
            payAmount: value,
            payCurrency: payCurrency || "USD",
            topupAmount: receivedAmount,
            topupCurrency: receivedCurrency,
            paymentMethod: payMethod,
            originCountry: payOrigin,
          },
        }),
      };
    },
    onSuccess: (r) => {
      if (r.kind === "wallet") {
        toast.success(interpolate(t("topup.success_sent"), { reference: r.result.reference }));
        celebrateLogo();
        setPhone("");
        setAmount("");
        refreshWallet();
        void qc.invalidateQueries({ queryKey: ["topups"] });
        return;
      }

      if (r.result.mode === "checkout") {
        setPendingResult(r.result);
        setPhone("");
        setAmount("");
        void qc.invalidateQueries({ queryKey: ["topups"] });
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
      <h1 className="text-2xl font-bold">{t("topup.title")}</h1>

      {profile?.kyc_status !== "approved" && (
        <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {profile?.kyc_status === "pending" ? t("topup.kyc_pending") : t("topup.kyc_none")}{" "}
          <Link to="/perfil" className="font-semibold underline">
            {profile?.kyc_status === "pending" ? t("send.kyc_view") : t("send.kyc_verify")}
          </Link>
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="size-4" /> {t("topup.send_recharge")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t("topup.pay_country")}</Label>
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
            <Label>{t("topup.pay_method")}</Label>
            <Select value={payMethod} onValueChange={setPayMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {payMethods.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.value === "wallet" ? t("topup.wallet_balance") : paymentLabel(m.value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t("topup.number_country")}</Label>
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
            <Label>
              {t("topup.operator_of")} {countryInfo?.label ?? country}
            </Label>
            <Select
              value={operator}
              onValueChange={(v) => {
                setOperator(v);
                setSku("");
              }}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    isFetching ? t("topup.loading_operators") : t("topup.choose_operator")
                  }
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
              <p className="text-xs text-muted-foreground">{t("topup.provider_fallback_note")}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>{t("topup.plan")}</Label>
            <Select value={sku} onValueChange={setSku} disabled={plans.length === 0}>
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    !operator
                      ? t("topup.choose_operator_first")
                      : plans.length === 0
                        ? t("topup.free_amount")
                        : t("topup.choose_plan")
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
            <Label htmlFor="tu-phone">{t("topup.number_to_recharge")}</Label>
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
              <p className="text-xs text-muted-foreground">
                {t("topup.will_send_to")} {phoneCheck.e164}
              </p>
            ) : lengths.length ? (
              <p className="text-xs text-muted-foreground">
                {interpolate(t("topup.digits_for"), {
                  n: lengths.join(" o "),
                  country: countryInfo?.label ?? country,
                })}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tu-amount">
              {t("topup.amount_to_pay")} {payCurrency ? `(${payCurrency})` : ""}
            </Label>
            <Input
              id="tu-amount"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {hasAmount && receivedAmount != null && (
              <p className="text-sm font-medium text-accent">
                {t("topup.recipient_gets")}: {receivedAmount} {receivedCurrency}
              </p>
            )}
            {missingRate && (
              <p className="text-xs text-destructive">
                {interpolate(t("topup.no_rate_configured"), {
                  from: payCurrency,
                  to: operatorCurrency,
                })}
              </p>
            )}
            {selected?.minValue != null && (
              <p className="text-xs text-muted-foreground">
                {t("topup.operator_range")}: {selected.minValue} – {selected.maxValue}{" "}
                {selected.currency}
              </p>
            )}
          </div>

          <div className="sm:col-span-2">
            <Button
              className="w-full"
              disabled={
                sendMut.isPending ||
                !phoneCheck.ok ||
                profile?.kyc_status !== "approved" ||
                missingRate
              }
              onClick={() => sendMut.mutate()}
            >
              <Send className="mr-2 size-4" />
              {sendMut.isPending
                ? t("topup.sending")
                : payMethod === "wallet"
                  ? t("topup.send_recharge")
                  : payMethod === "oxxo"
                    ? t("topup.generate_oxxo")
                    : payMethod === "spei"
                      ? t("topup.generate_spei")
                      : t("topup.pay_card")}
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              {payMethod === "wallet" ? t("topup.wallet_note") : t("topup.external_note")}
            </p>
          </div>
        </CardContent>
      </Card>

      {pendingResult?.mode === "checkout" && (
        <Card className="border-accent/40">
          <CardHeader>
            <CardTitle className="text-base">{t("topup.complete_payment")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("topup.go_pay_desc")}</p>
            <Button asChild className="w-full">
              <a href={pendingResult.checkoutUrl} target="_blank" rel="noreferrer">
                {t("topup.go_pay")}
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      {pendingResult?.mode === "voucher" && (
        <Card className="border-accent/40">
          <CardHeader>
            <CardTitle className="text-base">{t("topup.oxxo_voucher_title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl bg-secondary p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                {t("topup.oxxo_reference")}
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
                  toast.success(t("topup.reference_copied"));
                }}
              >
                <Copy className="size-4" /> {t("topup.copy_reference")}
              </Button>
              {pendingResult.voucher.voucherUrl && (
                <Button size="sm" className="gap-2" asChild>
                  <a href={pendingResult.voucher.voucherUrl} target="_blank" rel="noreferrer">
                    {t("topup.view_receipt")}
                  </a>
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t("topup.oxxo_note")}</p>
          </CardContent>
        </Card>
      )}

      {pendingResult?.mode === "spei" && (
        <Card className="border-accent/40">
          <CardHeader>
            <CardTitle className="text-base">{t("topup.spei_title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl bg-secondary p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                {t("topup.clabe")}
              </p>
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
                toast.success(t("topup.clabe_copied"));
              }}
            >
              <Copy className="size-4" /> {t("topup.copy_clabe")}
            </Button>
            <p className="text-xs text-muted-foreground">{t("topup.spei_note")}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("topup.history_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(topups ?? []).length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">{t("topup.no_history")}</p>
          )}
          {(topups ?? []).map((t2) => (
            <div
              key={t2.id}
              className="flex items-center justify-between rounded-lg border p-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  {t2.operator || t2.sku_code} · {t2.phone}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t2.reference} · {shortDate(t2.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="font-semibold">{money(Number(t2.amount), t2.currency)}</p>
                  <p className="text-[11px] text-muted-foreground">{t("topup.received")}</p>
                </div>
                <Badge variant={t2.status === "completed" ? "default" : "secondary"}>
                  {STATUS_LABEL[t2.status] ?? t2.status}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
