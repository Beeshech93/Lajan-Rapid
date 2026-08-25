import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, Bell, Coins, History, Send, ShieldAlert, Smartphone, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useCountries, useRate } from "@/hooks/useCorridors";
import { useWallets } from "@/hooks/useWallet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { money, shortDate, STATUS_LABEL, STATUS_TONE, type TransferStatus } from "@/lib/remesa";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Inicio — Lajan Rapid" },
      { name: "description", content: "Resumen de tus envíos, tipo de cambio y avisos." },
      { property: "og:title", content: "Inicio — Lajan Rapid" },
      { property: "og:description", content: "Resumen de tus envíos y tipo de cambio actual." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { profile, user } = useProfile();
  const { data: countries } = useCountries();
  const [origin, setOrigin] = useState("MX");
  const [destination, setDestination] = useState("HT");

  const origins = (countries ?? []).filter((c) => c.is_origin);
  const destinations = (countries ?? []).filter((c) => c.is_destination);
  const sendCur = origins.find((c) => c.code === origin)?.currency ?? "";
  const recvCur = destinations.find((c) => c.code === destination)?.currency ?? "";

  const { data: rate } = useRate(sendCur, recvCur);

  const { data: transfers } = useQuery({
    queryKey: ["my-transfers", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("transfers")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const { data: wallets } = useWallets();

  const { data: notifs } = useQuery({
    queryKey: ["notifs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(4);
      return data ?? [];
    },
  });

  const totalHtg = (wallets ?? []).reduce(
    (sum, w) => sum + (w.currency === "HTG" ? Number(w.balance) : 0),
    0,
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-4">
      <div className="rise-in flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Hola,</p>
          <h1 className="truncate text-2xl font-bold">{profile?.full_name || "bienvenido"} 👋</h1>
        </div>
      </div>

      {profile && profile.kyc_status !== "approved" && (
        <Card className="border-warning/40 bg-warning/10 shadow-none">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning-foreground" />
              <div className="min-w-0">
                <p className="font-semibold">
                  {profile.kyc_status === "pending"
                    ? "Verificación en revisión"
                    : profile.kyc_status === "rejected"
                      ? "Verificación rechazada"
                      : "Verifica tu identidad"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Necesitas KYC aprobado para que tus envíos se procesen.
                </p>
              </div>
            </div>
            <Button asChild size="sm" variant="secondary" className="press">
              <Link to="/perfil">Ir a verificación</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Balance hero */}
      <section className="rise-in bg-brand shadow-lift relative overflow-hidden rounded-[var(--radius-3xl)] p-6 text-primary-foreground">
        <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-accent/25 blur-3xl" aria-hidden />
        <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-70">Saldo disponible</p>
        <p className="mt-2 font-display text-4xl font-bold tracking-tight">
          {money(totalHtg, "HTG")}
        </p>
        <p className="mt-1 text-sm opacity-75">
          {(wallets ?? []).length === 0
            ? "Recibe cripto y conviértelo en gourdes."
            : "Disponible para retirar por MonCash o NatCash."}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button asChild className="press gap-2 bg-primary-foreground text-primary hover:bg-primary-foreground/90">
            <Link to="/enviar">
              <Send className="size-4" /> Enviar
            </Link>
          </Button>
          <Button asChild variant="outline" className="press gap-2 border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground">
            <Link to="/cripto">
              <Coins className="size-4" /> Cripto
            </Link>
          </Button>
        </div>
      </section>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-2.5">
        {[
          { to: "/enviar", label: "Enviar", icon: Send },
          { to: "/cripto", label: "Cripto", icon: Coins },
          { to: "/recargas", label: "Recargas", icon: Smartphone },
          { to: "/historial", label: "Historial", icon: History },
        ].map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="press card-elevated flex flex-col items-center gap-2 px-2 py-4 text-center"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-accent/12 text-accent">
              <a.icon className="size-5" />
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground">{a.label}</span>
          </Link>
        ))}
      </div>

      {/* Rate card */}
      <Card className="card-elevated border-transparent">
        <CardContent className="p-5">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <TrendingUp className="size-4 text-accent" /> Tipo de cambio de hoy
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Select value={origin} onValueChange={setOrigin}>
              <SelectTrigger>
                <SelectValue placeholder="Desde" />
              </SelectTrigger>
              <SelectContent>
                {origins.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.flag} {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={destination} onValueChange={setDestination}>
              <SelectTrigger>
                <SelectValue placeholder="Hacia" />
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
          <p className="mt-4 font-display text-2xl font-bold">
            1 {sendCur || "—"} = {rate ? Number(rate.rate).toFixed(4) : "—"} {recvCur || "—"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Comisión{" "}
            {rate ? `${Number(rate.fee_percent)}% + ${money(Number(rate.fee_fixed), sendCur)}` : "—"}
          </p>
        </CardContent>
      </Card>

      <Card className="card-elevated border-transparent">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Envíos recientes</CardTitle>
          <Button asChild variant="ghost" size="sm" className="gap-1 text-accent">
            <Link to="/historial">
              Ver todo <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {(transfers ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Aún no tienes envíos.</p>
          )}
          {(transfers ?? []).map((t) => (
            <Link
              key={t.id}
              to="/transferencia/$id"
              params={{ id: t.id }}
              className="press flex items-center gap-3 rounded-2xl border border-border/60 p-3 transition-colors hover:bg-secondary"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/12 text-accent">
                <Send className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{t.recipient_name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {t.origin_country} → {t.destination_country} · {shortDate(t.created_at)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold">{money(Number(t.amount_send), t.send_currency)}</p>
                <Badge className={STATUS_TONE[t.status as TransferStatus]} variant="secondary">
                  {STATUS_LABEL[t.status as TransferStatus]}
                </Badge>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card className="card-elevated border-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="size-4 text-accent" /> Avisos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(notifs ?? []).length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">Sin avisos por ahora.</p>
          )}
          {(notifs ?? []).map((n) => (
            <div key={n.id} className="rounded-2xl bg-secondary p-3">
              <p className="text-sm font-medium">{n.title}</p>
              <p className="text-xs text-muted-foreground">{n.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="pb-2 text-center text-xs text-muted-foreground">
        Los montos en moneda de destino se calculan con el tipo de cambio vigente al momento del
        envío.
      </p>
    </div>
  );
}

