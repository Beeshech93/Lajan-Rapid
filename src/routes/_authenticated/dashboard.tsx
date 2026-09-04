import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowRight,
  Bell,
  Coins,
  Eye,
  EyeOff,
  Send,
  ShieldAlert,
  Smartphone,
  TrendingUp,
} from "lucide-react";
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
import { useI18n } from "@/lib/i18n";

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
  const { t } = useI18n();
  const { data: countries } = useCountries();
  const [origin, setOrigin] = useState("MX");
  const [destination, setDestination] = useState("HT");
  const [hideBalance, setHideBalance] = useState(false);

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
      {profile && profile.kyc_status !== "approved" && (
        <Card className="border-warning/40 bg-warning/10 shadow-none">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" />
              <div className="min-w-0">
                <p className="font-semibold">
                  {profile.kyc_status === "pending"
                    ? t("dash.kyc_pending_title")
                    : profile.kyc_status === "rejected"
                      ? t("dash.kyc_rejected_title")
                      : t("dash.kyc_none_title")}
                </p>
                <p className="text-sm text-muted-foreground">{t("dash.kyc_desc")}</p>
              </div>
            </div>
            <Button asChild size="sm" variant="secondary" className="press">
              <Link to="/perfil">{t("dash.kyc_cta")}</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Balance hero — estilo app: marca centrada, saldo grande y acciones pill */}
      <section className="rise-in bg-brand shadow-lift relative overflow-hidden rounded-[var(--radius-3xl)] px-6 pb-7 pt-6 text-center text-primary-foreground">
        <div
          className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-accent/25 blur-3xl"
          aria-hidden
        />
        <div className="relative flex items-center justify-center gap-2">
          <span className="grid size-7 place-items-center rounded-full bg-primary-foreground/15">
            <Coins className="size-4" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">Lajan Rapid</span>
        </div>
        <p className="relative mt-6 text-sm opacity-70">
          {t("dash.balance_label")} ·{" "}
          {profile?.full_name?.split(" ")[0] || t("dash.welcome_fallback")}
        </p>
        <div className="relative mt-1 flex items-center justify-center gap-3">
          <p className="font-display text-4xl font-bold tracking-tight">
            {hideBalance ? "•••••" : money(totalHtg, "HTG")}
          </p>
          <button
            type="button"
            onClick={() => setHideBalance((v) => !v)}
            aria-label={hideBalance ? t("dash.show_balance") : t("dash.hide_balance")}
            className="press grid size-8 place-items-center rounded-full text-primary-foreground/80 hover:bg-primary-foreground/10"
          >
            {hideBalance ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </button>
        </div>
        <div className="relative mx-auto mt-6 grid max-w-sm grid-cols-2 gap-3">
          <Button
            asChild
            className="press h-11 rounded-full gap-2 bg-primary-foreground text-primary hover:bg-primary-foreground/90"
          >
            <Link to="/enviar">
              <Send className="size-4" /> {t("dash.send")}
            </Link>
          </Button>
          <Button
            asChild
            className="press h-11 rounded-full gap-2 bg-primary-foreground text-primary hover:bg-primary-foreground/90"
          >
            <Link to="/cripto">
              <Coins className="size-4" /> {t("dash.receive")}
            </Link>
          </Button>
        </div>
      </section>

      {/* Quick actions */}
      <Card className="card-elevated border-transparent">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t("dash.quick_actions")}</CardTitle>
          <Button asChild variant="ghost" size="sm" className="gap-1 text-accent">
            <Link to="/historial">
              {t("dash.see_more")} <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {[
              { to: "/enviar", label: t("dash.send"), icon: Send },
              { to: "/recargas", label: t("dash.topups"), icon: Smartphone },
              { to: "/cripto", label: t("dash.crypto"), icon: Coins },
            ].map((a) => (
              <Link
                key={a.to}
                to={a.to}
                className="press flex flex-col items-center gap-2 rounded-2xl bg-secondary px-2 py-5 text-center"
              >
                <span className="grid size-11 place-items-center rounded-full bg-accent/15 text-accent">
                  <a.icon className="size-5" />
                </span>
                <span className="text-xs font-semibold">{a.label}</span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Rate card */}
      <Card className="card-elevated border-transparent">
        <CardContent className="p-5">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <TrendingUp className="size-4 text-accent" /> {t("dash.rate_today")}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Select value={origin} onValueChange={setOrigin}>
              <SelectTrigger>
                <SelectValue placeholder={t("dash.from")} />
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
                <SelectValue placeholder={t("dash.to")} />
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
            {t("dash.fee")}{" "}
            {rate
              ? `${Number(rate.fee_percent)}% + ${money(Number(rate.fee_fixed), sendCur)}`
              : "—"}
          </p>
        </CardContent>
      </Card>

      <Card className="card-elevated border-transparent">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t("dash.recent_transfers")}</CardTitle>
          <Button asChild variant="ghost" size="sm" className="gap-1 text-accent">
            <Link to="/historial">
              {t("dash.see_all")} <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {(transfers ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("dash.no_transfers")}
            </p>
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
            <Bell className="size-4 text-accent" /> {t("dash.notices")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(notifs ?? []).length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">{t("dash.no_notices")}</p>
          )}
          {(notifs ?? []).map((n) => (
            <div key={n.id} className="rounded-2xl bg-secondary p-3">
              <p className="text-sm font-medium">{n.title}</p>
              <p className="text-xs text-muted-foreground">{n.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="pb-2 text-center text-xs text-muted-foreground">{t("dash.footer_note")}</p>
    </div>
  );
}
