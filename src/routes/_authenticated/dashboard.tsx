import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, Bell, ShieldAlert, TrendingUp } from "lucide-react";
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
      { title: "Inicio — RemesaHaití" },
      { name: "description", content: "Resumen de tus envíos, tipo de cambio y avisos." },
      { property: "og:title", content: "Inicio — RemesaHaití" },
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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Hola,</p>
        <h1 className="text-2xl font-bold">{profile?.full_name || "bienvenido"} 👋</h1>
      </div>

      {profile && profile.kyc_status !== "approved" && (
        <Card className="border-warning/40 bg-warning/10">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 size-5 text-warning-foreground" />
              <div>
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
            <Button asChild size="sm" variant="secondary">
              <Link to="/perfil">Ir a verificación</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="bg-brand text-primary-foreground sm:col-span-2">
          <CardContent className="p-5">
            <p className="flex items-center gap-2 text-xs font-semibold opacity-80">
              <TrendingUp className="size-4" /> Tipo de cambio de hoy
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Select value={origin} onValueChange={setOrigin}>
                <SelectTrigger className="bg-primary-foreground/10 text-primary-foreground">
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
                <SelectTrigger className="bg-primary-foreground/10 text-primary-foreground">
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
            <p className="mt-3 font-display text-3xl font-bold">
              1 {sendCur || "—"} = {rate ? Number(rate.rate).toFixed(4) : "—"} {recvCur || "—"}
            </p>
            <p className="mt-1 text-sm opacity-80">
              Comisión{" "}
              {rate
                ? `${Number(rate.fee_percent)}% + ${money(Number(rate.fee_fixed), sendCur)}`
                : "—"}
            </p>
            <Button asChild variant="secondary" className="mt-4 gap-2">
              <Link to="/enviar">
                Enviar dinero <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold text-muted-foreground">Envíos recientes</p>
            <p className="mt-2 font-display text-2xl font-bold">{transfers?.length ?? 0}</p>
            <p className="mt-1 text-sm text-muted-foreground">operaciones registradas</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Mi billetera</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to="/billetera">Administrar</Link>
          </Button>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          {(wallets ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              Aún no tienes saldo. Crea tu billetera para recibir remesas y pagar en línea.
            </p>
          )}
          {(wallets ?? []).map((w) => (
            <div key={w.id} className="rounded-xl border px-4 py-3">
              <p className="text-xs text-muted-foreground">{w.currency}</p>
              <p className="font-display text-lg font-semibold">
                {money(Number(w.balance), w.currency)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>



      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Envíos recientes</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to="/historial">Ver todo</Link>
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
              className="flex items-center justify-between rounded-xl border p-3 transition-colors hover:bg-secondary"
            >
              <div>
                <p className="font-medium">{t.recipient_name}</p>
                <p className="text-xs text-muted-foreground">
                  {t.reference} · {t.origin_country} → {t.destination_country} ·{" "}
                  {shortDate(t.created_at)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">
                  {money(Number(t.amount_send), t.send_currency)}
                </p>
                <Badge className={STATUS_TONE[t.status as TransferStatus]} variant="secondary">
                  {STATUS_LABEL[t.status as TransferStatus]}
                </Badge>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="size-4" /> Avisos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(notifs ?? []).length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">Sin avisos por ahora.</p>
          )}
          {(notifs ?? []).map((n) => (
            <div key={n.id} className="rounded-lg bg-secondary p-3">
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
