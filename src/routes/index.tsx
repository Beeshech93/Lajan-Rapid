import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, ShieldCheck, Timer, Wallet, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { quote, money } from "@/lib/remesa";
import { useCountries, useRate } from "@/hooks/useCorridors";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lajan Rapid — Envía dinero a Haití y República Dominicana" },
      {
        name: "description",
        content:
          "Envía dinero desde América y Europa a Haití y República Dominicana en minutos. Tipo de cambio transparente y seguimiento en tiempo real.",
      },
      { property: "og:title", content: "Lajan Rapid — Envía dinero a Haití y República Dominicana" },
      {
        property: "og:description",
        content:
          "Envía dinero desde América y Europa a Haití y República Dominicana en minutos. Tipo de cambio transparente y seguimiento en tiempo real.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t } = useI18n();
  const [origin, setOrigin] = useState("MX");
  const [destination, setDestination] = useState("HT");
  const [amount, setAmount] = useState("2000");
  const { data: countries } = useCountries();

  const origins = (countries ?? []).filter((c) => c.is_origin);
  const destinations = (countries ?? []).filter((c) => c.is_destination);
  const originCountry = origins.find((c) => c.code === origin);
  const destCountry = destinations.find((c) => c.code === destination);
  const sendCurrency = originCountry?.currency ?? "MXN";
  const receiveCurrency = destCountry?.currency ?? "HTG";
  const { data: cfg } = useRate(sendCurrency, receiveCurrency);

  const q = quote(
    Number(amount),
    cfg ?? { rate: 0, fee_percent: 0, fee_fixed: 0, agent_commission_percent: 0 },
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-brand font-display text-lg font-bold text-primary-foreground">
            LR
          </span>
          <span className="font-display text-lg font-semibold">Lajan Rapid</span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher className="h-9 w-[132px] text-xs" />
          <Button asChild variant="ghost" size="sm">
            <Link to="/auth">{t("auth.signin")}</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/auth" search={{ modo: "registro" }}>
              {t("auth.signup")}
            </Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-6 lg:grid-cols-2 lg:pt-14">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent-foreground">
            <TrendingUp className="size-3.5" /> {t("landing.badge")}
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl">
            {t("landing.title")}
          </h1>
          <p className="mt-4 max-w-lg text-base text-muted-foreground sm:text-lg">
            {t("landing.subtitle")}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg" className="gap-2">
              <Link to="/auth" search={{ modo: "registro" }}>
                {t("landing.cta")} <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">{t("landing.have_account")}</Link>
            </Button>
          </div>
          <dl className="mt-9 grid grid-cols-3 gap-4 border-t pt-6">
            <Stat icon={Timer} title={t("landing.stat_minutes")} desc={t("landing.stat_minutes_desc")} />
            <Stat icon={ShieldCheck} title="KYC" desc={t("landing.stat_kyc_desc")} />
            <Stat icon={Wallet} title={t("landing.stat_countries")} desc={t("landing.stat_countries_desc")} />
          </dl>
        </div>

        <div className="relative">
          <Card className="mx-auto w-full shadow-lift">

            <CardContent className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">{t("landing.from")}</span>
                  <Select value={origin} onValueChange={setOrigin}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {origins.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.flag} {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">{t("landing.to")}</span>
                  <Select value={destination} onValueChange={setDestination}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {destinations.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.flag} {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label htmlFor="monto" className="text-xs font-semibold text-muted-foreground">
                  {t("landing.you_send")} ({sendCurrency})
                </label>
                <Input
                  id="monto"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  className="mt-1 h-12 text-lg font-semibold"
                />
              </div>
              <div className="space-y-1.5 rounded-xl bg-secondary p-4 text-sm">
                <Row
                  label={t("landing.rate")}
                  value={
                    cfg
                      ? `1 ${sendCurrency} = ${Number(cfg.rate).toFixed(4)} ${receiveCurrency}`
                      : t("landing.unavailable")
                  }
                />
                <Row label={t("landing.fee")} value={money(q.fee, sendCurrency)} />
                <Row label={t("landing.total")} value={money(q.total, sendCurrency)} strong />
              </div>
              <div className="rounded-xl bg-mint p-4">
                <p className="text-xs font-semibold text-accent-foreground/80">{t("landing.family_gets")}</p>
                <p className="font-display text-2xl font-bold text-accent-foreground">
                  {money(q.receives, receiveCurrency)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        {t("landing.footer")}
      </footer>
    </div>
  );
}

function Stat({ icon: Icon, title, desc }: { icon: typeof Timer; title: string; desc: string }) {
  return (
    <div>
      <Icon className="size-5 text-accent" />
      <dt className="mt-2 font-display text-base font-semibold">{title}</dt>
      <dd className="text-xs text-muted-foreground">{desc}</dd>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}
