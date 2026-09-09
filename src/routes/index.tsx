import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, ShieldCheck, Timer, Wallet, TrendingUp } from "lucide-react";

import logoAsset from "@/assets/lajan-rapid-logo.png.asset.json";
import womanPhoneAsset from "@/assets/woman-phone-navy.png.asset.json";
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
      {
        title: "Lajan Rapid | Send Money to Haiti from USA, Canada, Mexico, Brazil, Chile & France",
      },
      {
        name: "description",
        content:
          "Lajan Rapid makes international money transfers to Haiti simple, fast and secure. Send money to Haiti from the USA, Canada, Mexico, Brazil, Chile and France.",
      },
      {
        name: "keywords",
        content:
          "Lajan Rapid, send money to Haiti, Haiti remittance, Haiti money transfer, USA Haiti money transfer, Canada Haiti money transfer, Mexico Haiti remittance, Brazil Haiti transfer, Chile Haiti remittance, France Haiti transfer, MonCash, NatCash",
      },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      {
        property: "og:title",
        content:
          "Lajan Rapid | Send Money to Haiti from USA, Canada, Mexico, Brazil, Chile & France",
      },
      {
        property: "og:description",
        content:
          "Lajan Rapid makes international money transfers to Haiti simple, fast and secure. Send money to Haiti from the USA, Canada, Mexico, Brazil, Chile and France.",
      },
    ],
    links: [{ rel: "canonical", href: "https://lajanrapid.app/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Lajan Rapid",
          url: "https://lajanrapid.app/",
          description:
            "Lajan Rapid is an international money transfer and remittance service connecting customers with recipients in Haiti.",
          knowsAbout: [
            "Money transfers",
            "Remittances",
            "Haiti money transfers",
            "USA to Haiti money transfer",
            "Canada to Haiti money transfer",
            "Mexico to Haiti money transfer",
            "Brazil to Haiti money transfer",
            "Chile to Haiti money transfer",
            "France to Haiti money transfer",
          ],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Lajan Rapid",
          url: "https://lajanrapid.app/",
          // Solo los idiomas que la app realmente soporta (ver src/lib/i18n.tsx).
          inLanguage: ["en", "es", "fr", "ht"],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          name: "Lajan Rapid International Money Transfer",
          provider: {
            "@type": "Organization",
            name: "Lajan Rapid",
            url: "https://lajanrapid.app/",
          },
          serviceType: "Money transfer and remittance service",
          areaServed: ["United States", "Canada", "Mexico", "Brazil", "Chile", "France", "Haiti"],
          url: "https://lajanrapid.app/",
        }),
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
    <div className="min-h-screen bg-secondary">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center overflow-hidden rounded-xl bg-logo-surface p-1 shadow-soft">
            <img src={logoAsset.url} alt="Lajan Rapid" className="h-full w-full object-contain" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-foreground">
            Lajan Rapid
          </span>
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

      <div className="mx-auto max-w-6xl px-4 pb-10 sm:px-5">
        <div className="grid overflow-hidden rounded-[2rem] shadow-lift lg:grid-cols-[1fr_1.15fr]">
          {/* Panel claro: mensaje + llamado a la acción */}
          <div className="flex flex-col justify-center bg-card p-8 sm:p-12">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <TrendingUp className="size-3.5" /> {t("landing.badge")}
            </span>
            <h1 className="mt-6 font-display text-4xl font-bold leading-[1.05] text-foreground sm:text-5xl">
              {t("landing.title")}
            </h1>
            <p className="mt-5 max-w-md text-base text-muted-foreground sm:text-lg">
              {t("landing.subtitle")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="gap-2">
                <Link to="/auth" search={{ modo: "registro" }}>
                  {t("landing.cta")} <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth">{t("landing.have_account")}</Link>
              </Button>
            </div>

            <dl className="mt-10 grid grid-cols-3 gap-4 border-t pt-6">
              <MiniStat icon={Timer} title={t("landing.stat_minutes")} />
              <MiniStat icon={ShieldCheck} title="KYC" />
              <MiniStat icon={Wallet} title={t("landing.stat_countries")} />
            </dl>
          </div>

          {/* Panel de color: foto + calculadora */}
          <div className="relative flex flex-col justify-center gap-6 bg-brand p-8 text-primary-foreground sm:p-12">
            <div className="flex items-center gap-4">
              <div className="w-24 shrink-0 overflow-hidden rounded-2xl border border-primary-foreground/10 shadow-lift shadow-black/20 sm:w-28">
                <img
                  src={womanPhoneAsset.url}
                  alt="Mujer sonriendo mientras usa Lajan Rapid en su teléfono"
                  className="aspect-[3/4] w-full object-cover"
                />
              </div>
              <p className="font-display text-xl font-bold leading-tight sm:text-2xl">
                {t("landing.family_gets")}
              </p>
            </div>

            <Card className="border-transparent shadow-lift">
              <CardContent className="space-y-4 p-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("landing.from")}
                    </span>
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
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("landing.to")}
                    </span>
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
                  <label
                    htmlFor="monto"
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {t("landing.you_send")} ({sendCurrency})
                  </label>
                  <Input
                    id="monto"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                    className="mt-1 h-14 font-display text-2xl font-bold"
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
                  <p className="text-xs font-semibold uppercase tracking-wide text-warning-foreground/80">
                    {t("landing.family_gets")}
                  </p>
                  <p className="font-display text-3xl font-bold text-warning-foreground">
                    {money(q.receives, receiveCurrency)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <footer className="py-8 text-center text-sm text-muted-foreground">
        <p>{t("landing.footer")}</p>
        <p className="mt-2">
          <Link to="/privacidad" className="underline hover:text-foreground">
            Política de Privacidad
          </Link>
        </p>
      </footer>
    </div>
  );
}

function MiniStat({ icon: Icon, title }: { icon: typeof Timer; title: string }) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <span className="grid size-8 place-items-center rounded-lg bg-accent/15 text-accent">
        <Icon className="size-4" />
      </span>
      <p className="text-xs font-medium leading-tight text-foreground">{title}</p>
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
