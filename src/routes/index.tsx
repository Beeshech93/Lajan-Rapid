import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, ShieldCheck, Timer, Wallet, TrendingUp } from "lucide-react";
import heroImg from "@/assets/hero.jpg";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { quote, mxn, htg, type RateConfig } from "@/lib/remesa";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RemesaHaití — Envía dinero de México a Haití" },
      {
        name: "description",
        content:
          "Envía dinero de México a Haití en minutos. Tipo de cambio transparente, comisiones claras y seguimiento en tiempo real.",
      },
      { property: "og:title", content: "RemesaHaití — Envía dinero de México a Haití" },
      {
        property: "og:description",
        content: "Envía dinero de México a Haití en minutos. Tipo de cambio transparente, comisiones claras y seguimiento en tiempo real.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [cfg, setCfg] = useState<RateConfig | null>(null);
  const [amount, setAmount] = useState("2000");

  useEffect(() => {
    supabase
      .from("exchange_rates")
      .select("rate, fee_percent, fee_fixed, agent_commission_percent")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setCfg(data as RateConfig | null));
  }, []);

  const q = quote(Number(amount), cfg ?? { rate: 0, fee_percent: 0, fee_fixed: 0, agent_commission_percent: 0 });

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
            <TrendingUp className="size-3.5" /> México → Haití en minutos
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl">
            Envía dinero a casa sin sorpresas
          </h1>
          <p className="mt-4 max-w-lg text-base text-muted-foreground sm:text-lg">
            Tipo de cambio claro, comisión visible antes de pagar y seguimiento en tiempo real hasta
            que tu familia recibe los gourdes.
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
            <Stat icon={Wallet} title="4 formas" desc="De pago en México" />
          </dl>
        </div>

        <div className="relative">
          <Card className="mx-auto w-full shadow-lift">

            <CardContent className="space-y-4 p-5">
              <div>
                <label htmlFor="monto" className="text-xs font-semibold text-muted-foreground">
                  Tú envías (MXN)
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
                <Row label="Tipo de cambio" value={cfg ? `1 MXN = ${cfg.rate.toFixed(4)} HTG` : "—"} />
                <Row label="Comisión" value={mxn(q.fee)} />
                <Row label="Total a pagar" value={mxn(q.total)} strong />
              </div>
              <div className="rounded-xl bg-mint p-4">
                <p className="text-xs font-semibold text-accent-foreground/80">Tu familia recibe</p>
                <p className="font-display text-2xl font-bold text-accent-foreground">{htg(q.receives)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        RemesaHaití · Remesas México → Haití
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
