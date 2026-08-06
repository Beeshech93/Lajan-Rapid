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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RemesaHaití — Envía dinero a Haití y República Dominicana" },
      {
        name: "description",
        content:
          "Envía dinero desde América y Europa a Haití y República Dominicana en minutos. Tipo de cambio transparente y seguimiento en tiempo real.",
      },
      { property: "og:title", content: "RemesaHaití — Envía dinero a Haití y República Dominicana" },
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
            R
          </span>
          <span className="font-display text-lg font-semibold">RemesaHaití</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/auth">Iniciar sesión</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/auth" search={{ modo: "registro" }}>
              Crear cuenta
            </Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-6 lg:grid-cols-2 lg:pt-14">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent-foreground">
            <TrendingUp className="size-3.5" /> América y Europa → Haití y R. Dominicana
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl">
            Envía dinero a casa sin sorpresas
          </h1>
          <p className="mt-4 max-w-lg text-base text-muted-foreground sm:text-lg">
            Tipo de cambio claro, comisión visible antes de pagar y seguimiento en tiempo real hasta
            que tu familia recibe el dinero en Haití o República Dominicana.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg" className="gap-2">
              <Link to="/auth" search={{ modo: "registro" }}>
                Enviar dinero <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">Ya tengo cuenta</Link>
            </Button>
          </div>
          <dl className="mt-9 grid grid-cols-3 gap-4 border-t pt-6">
            <Stat icon={Timer} title="Minutos" desc="Entrega típica" />
            <Stat icon={ShieldCheck} title="KYC" desc="Identidad verificada" />
            <Stat icon={Wallet} title="+30 países" desc="De origen" />
          </dl>
        </div>

        <div className="relative">
          <Card className="mx-auto w-full shadow-lift">

            <CardContent className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">Desde</span>
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
                  <span className="text-xs font-semibold text-muted-foreground">Hacia</span>
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
                  Tú envías ({sendCurrency})
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
                  label="Tipo de cambio"
                  value={
                    cfg
                      ? `1 ${sendCurrency} = ${Number(cfg.rate).toFixed(4)} ${receiveCurrency}`
                      : "No disponible"
                  }
                />
                <Row label="Comisión" value={money(q.fee, sendCurrency)} />
                <Row label="Total a pagar" value={money(q.total, sendCurrency)} strong />
              </div>
              <div className="rounded-xl bg-mint p-4">
                <p className="text-xs font-semibold text-accent-foreground/80">Tu familia recibe</p>
                <p className="font-display text-2xl font-bold text-accent-foreground">
                  {money(q.receives, receiveCurrency)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        RemesaHaití · Remesas hacia Haití y República Dominicana
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
