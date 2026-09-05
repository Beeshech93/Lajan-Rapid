import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, ShieldCheck, Timer, Wallet, TrendingUp } from "lucide-react";

import logoAsset from "@/assets/lajan-rapid-logo.png.asset.json";
import womanPhoneAsset from "@/assets/woman-phone-navy.png.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { quote, money } from "@/lib/remesa";
import { useRate } from "@/hooks/useCorridors";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export function CorridorLanding({
  originCode,
  originCurrency,
  originFlag,
  heading,
  subheading,
  defaultAmount = "200",
}: {
  originCode: string;
  originCurrency: string;
  originFlag: string;
  heading: string;
  subheading: string;
  defaultAmount?: string;
}) {
  const { t } = useI18n();
  const [amount, setAmount] = useState(defaultAmount);
  const receiveCurrency = "HTG";
  const { data: cfg } = useRate(originCurrency, receiveCurrency);

  const q = quote(
    Number(amount),
    cfg ?? { rate: 0, fee_percent: 0, fee_fixed: 0, agent_commission_percent: 0 },
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-brand text-foreground">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center overflow-hidden rounded-xl bg-logo-surface p-1 shadow-soft">
              <img src={logoAsset.url} alt="Lajan Rapid" className="h-full w-full object-contain" />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">Lajan Rapid</span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher className="h-9 w-[132px] border-foreground/20 bg-foreground/10 text-xs text-foreground" />
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-foreground hover:bg-primary-foreground/10 hover:text-foreground"
            >
              <Link to="/auth">{t("auth.signin")}</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
            >
              <Link to="/auth" search={{ modo: "registro" }}>
                {t("auth.signup")}
              </Link>
            </Button>
          </div>
        </header>

        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-20 pt-8 lg:grid-cols-[0.95fr_1.1fr_1fr] lg:gap-12 lg:pb-28 lg:pt-16">
          <div className="relative mx-auto flex w-full max-w-[280px] justify-center lg:max-w-none lg:justify-start">
            <div className="relative w-full overflow-hidden rounded-[2rem] border border-primary-foreground/10 shadow-lift shadow-black/20">
              <img
                src={womanPhoneAsset.url}
                alt="Mujer sonriendo mientras usa Lajan Rapid en su teléfono"
                className="aspect-[3/4] w-full object-cover"
              />
            </div>
          </div>

          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-foreground/35 bg-foreground/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
              <TrendingUp className="size-3.5" /> {t("landing.badge")}
            </span>
            <h1 className="mt-6 font-display text-4xl font-bold leading-[1.03] sm:text-5xl lg:text-[3.2rem]">
              {heading}
            </h1>
            <p className="mt-5 max-w-lg text-base text-foreground/70 sm:text-lg">{subheading}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="gap-2 bg-primary-foreground text-primary hover:bg-primary-foreground/90"
              >
                <Link to="/auth" search={{ modo: "registro" }}>
                  {t("landing.cta")} <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-foreground/30 bg-transparent text-foreground hover:bg-foreground/10 hover:text-foreground"
              >
                <Link to="/auth">{t("landing.have_account")}</Link>
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 rounded-[2rem] bg-accent/10 blur-2xl" aria-hidden />
            <Card className="relative mx-auto w-full border-transparent shadow-lift">
              <CardContent className="space-y-4 p-6">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("landing.from")}
                    </span>
                    <p className="flex h-10 items-center rounded-md border px-3 font-medium">
                      {originFlag} {originCode}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("landing.to")}
                    </span>
                    <p className="flex h-10 items-center rounded-md border px-3 font-medium">
                      🇭🇹 Haïti
                    </p>
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="monto"
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {t("landing.you_send")} ({originCurrency})
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
                        ? `1 ${originCurrency} = ${Number(cfg.rate).toFixed(4)} ${receiveCurrency}`
                        : t("landing.unavailable")
                    }
                  />
                  <Row label={t("landing.fee")} value={money(q.fee, originCurrency)} />
                  <Row label={t("landing.total")} value={money(q.total, originCurrency)} strong />
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
        </section>
      </div>

      <section className="mx-auto -mt-12 max-w-6xl px-5 pb-20">
        <dl className="grid gap-4 sm:grid-cols-3">
          <Stat
            icon={Timer}
            title={t("landing.stat_minutes")}
            desc={t("landing.stat_minutes_desc")}
          />
          <Stat icon={ShieldCheck} title="KYC" desc={t("landing.stat_kyc_desc")} />
          <Stat
            icon={Wallet}
            title={t("landing.stat_countries")}
            desc={t("landing.stat_countries_desc")}
          />
        </dl>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
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

function Stat({ icon: Icon, title, desc }: { icon: typeof Timer; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-soft">
      <span className="grid size-10 place-items-center rounded-xl bg-accent/15 text-accent">
        <Icon className="size-5" />
      </span>
      <dt className="mt-4 font-display text-lg font-semibold">{title}</dt>
      <dd className="mt-1 text-sm text-muted-foreground">{desc}</dd>
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
