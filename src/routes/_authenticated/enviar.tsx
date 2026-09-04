import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useCountries, useRate } from "@/hooks/useCorridors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { quote, money, paymentMethods, deliveryMethods, citiesFor, ZERO_RATE } from "@/lib/remesa";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/enviar")({
  head: () => ({
    meta: [
      { title: "Enviar dinero — Lajan Rapid" },
      {
        name: "description",
        content:
          "Envía dinero desde América o Europa hacia Haití y República Dominicana con comisión transparente.",
      },
      { property: "og:title", content: "Enviar dinero — Lajan Rapid" },
      {
        property: "og:description",
        content: "Calcula, elige método de pago y envía a Haití o República Dominicana.",
      },
    ],
  }),
  component: Enviar,
});

function Enviar() {
  const router = useRouter();
  const { user, profile } = useProfile();
  const { t } = useI18n();
  const { data: countries } = useCountries();

  const schema = useMemo(
    () =>
      z.object({
        recipient_name: z.string().trim().min(3, t("send.error_name")).max(100),
        recipient_phone: z.string().trim().min(6, t("send.error_phone")).max(25),
        recipient_city: z.string().trim().min(2, t("send.error_city")).max(60),
        amount: z
          .number()
          .positive(t("send.error_amount"))
          .max(5_000_000, t("send.error_amount_high")),
        note: z.string().trim().max(300).optional(),
      }),
    [t],
  );

  const [origin, setOrigin] = useState("MX");
  const [destination, setDestination] = useState("HT");
  const [amount, setAmount] = useState("2000");
  const [payment, setPayment] = useState("oxxo");
  const [delivery, setDelivery] = useState("moncash");
  const [city, setCity] = useState("Port-au-Prince");
  const [saving, setSaving] = useState(false);

  const origins = (countries ?? []).filter((c) => c.is_origin);
  const destinations = (countries ?? []).filter((c) => c.is_destination);
  const originCountry = origins.find((c) => c.code === origin);
  const destCountry = destinations.find((c) => c.code === destination);

  const { data: cfg } = useRate(originCountry?.currency, destCountry?.currency);

  const payments = useMemo(() => paymentMethods(origin), [origin]);
  const deliveries = useMemo(() => deliveryMethods(destination), [destination]);
  const cities = useMemo(() => citiesFor(destination), [destination]);

  const sendCur = originCountry?.currency ?? "";
  const recvCur = destCountry?.currency ?? "";
  const q = quote(Number(amount), cfg ?? ZERO_RATE);

  const changeOrigin = (code: string) => {
    setOrigin(code);
    setPayment(paymentMethods(code)[0]?.value ?? "bank_transfer");
  };

  const changeDestination = (code: string) => {
    setDestination(code);
    setDelivery(deliveryMethods(code)[0]?.value ?? "moncash");
    setCity(citiesFor(code)[0] ?? "");
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!cfg || !user) return;
    if (profile?.kyc_status !== "approved") {
      toast.error(t("send.kyc_none"));
      return;
    }
    const form = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      recipient_name: String(form.get("recipient_name") ?? ""),
      recipient_phone: String(form.get("recipient_phone") ?? ""),
      recipient_city: city,
      amount: Number(amount),
      note: String(form.get("note") ?? ""),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? t("send.error_generic"));
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("transfers")
      .insert({
        user_id: user.id,
        origin_country: origin,
        destination_country: destination,
        recipient_name: parsed.data.recipient_name,
        recipient_phone: parsed.data.recipient_phone,
        recipient_city: parsed.data.recipient_city,
        delivery_method: delivery,
        payment_method: payment,
        amount_send: parsed.data.amount,
        rate: cfg.rate,
        note: parsed.data.note || null,
        status: "awaiting_payment",
      })
      .select("id")
      .single();
    setSaving(false);
    if (error) {
      toast.error(t("send.error_create"));
      return;
    }
    toast.success(t("send.success_create"));
    router.navigate({ to: "/transferencia/$id", params: { id: data.id } });
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold">{t("send.title")}</h1>

      {profile?.kyc_status !== "approved" && (
        <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {profile?.kyc_status === "pending" ? t("send.kyc_pending") : t("send.kyc_none")}{" "}
          <Link to="/perfil" className="font-semibold underline">
            {profile?.kyc_status === "pending" ? t("send.kyc_view") : t("send.kyc_verify")}
          </Link>
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("send.step1")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("send.from")}</Label>
              <Select value={origin} onValueChange={changeOrigin}>
                <SelectTrigger>
                  <SelectValue placeholder={t("send.from_placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {origins.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.flag} {c.name} · {c.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("send.to")}</Label>
              <Select value={destination} onValueChange={changeDestination}>
                <SelectTrigger>
                  <SelectValue placeholder={t("send.to_placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {destinations.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.flag} {c.name} · {c.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="monto">
              {t("send.you_send")} ({sendCur || "—"})
            </Label>
            <Input
              id="monto"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              className="h-12 text-lg font-semibold"
            />
          </div>

          {!cfg && sendCur && recvCur && (
            <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              {t("send.no_rate")}
            </p>
          )}

          <div className="space-y-1.5 rounded-xl bg-secondary p-4 text-sm">
            <Line
              label={t("send.rate")}
              value={cfg ? `1 ${sendCur} = ${Number(cfg.rate).toFixed(4)} ${recvCur}` : "—"}
            />
            <Line label={t("send.fee")} value={money(q.fee, sendCur)} />
            <Line label={t("send.total")} value={money(q.total, sendCur)} strong />
          </div>
          <div className="rounded-xl bg-mint p-4">
            <p className="text-xs font-semibold text-warning-foreground/80">
              {t("send.family_gets")}
            </p>
            <p className="font-display text-2xl font-bold text-warning-foreground">
              {money(q.receives, recvCur)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("send.step2")} {destCountry?.name ?? t("send.step2_fallback")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="recipient_name">{t("send.recipient_name")}</Label>
            <Input id="recipient_name" name="recipient_name" required maxLength={100} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recipient_phone">{t("send.recipient_phone")}</Label>
            <Input id="recipient_phone" name="recipient_phone" type="tel" required maxLength={25} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("send.city")}</Label>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger>
                <SelectValue placeholder={t("send.city_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {cities.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("send.delivery")}</Label>
            <Select value={delivery} onValueChange={setDelivery}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {deliveries.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label} — {d.hint}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="note">{t("send.note")}</Label>
            <Textarea id="note" name="note" maxLength={300} rows={2} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("send.step3")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {payments.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setPayment(m.value)}
              className={`rounded-xl border p-4 text-left transition-colors ${
                payment === m.value ? "border-accent bg-accent/10" : "hover:bg-secondary"
              }`}
            >
              <p className="font-medium">{m.label}</p>
              <p className="text-xs text-muted-foreground">{m.hint}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={saving || !cfg || profile?.kyc_status !== "approved"}
      >
        {saving ? t("send.creating") : `${t("send.confirm")} ${money(q.total, sendCur)}`}
      </Button>
    </form>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-semibold" : "font-medium"}>{value}</span>
    </div>
  );
}
