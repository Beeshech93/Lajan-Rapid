import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Bell, ShieldAlert, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { mxn, htg, shortDate, STATUS_LABEL, STATUS_TONE, type TransferStatus } from "@/lib/remesa";

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

  const { data: rate } = useQuery({
    queryKey: ["rate"],
    queryFn: async () => {
      const { data } = await supabase
        .from("exchange_rates")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

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

  const sentTotal = (transfers ?? []).reduce((a, t) => a + Number(t.amount_mxn), 0);

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
            <p className="mt-2 font-display text-3xl font-bold">
              1 MXN = {rate ? Number(rate.rate).toFixed(4) : "—"} HTG
            </p>
            <p className="mt-1 text-sm opacity-80">
              Comisión {rate ? `${Number(rate.fee_percent)}% + ${mxn(Number(rate.fee_fixed))}` : "—"}
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
            <p className="text-xs font-semibold text-muted-foreground">Enviado (últimos envíos)</p>
            <p className="mt-2 font-display text-2xl font-bold">{mxn(sentTotal)}</p>
            <p className="mt-1 text-sm text-muted-foreground">{transfers?.length ?? 0} operaciones</p>
          </CardContent>
        </Card>
      </div>

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
                  {t.reference} · {shortDate(t.created_at)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{mxn(Number(t.amount_mxn))}</p>
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
        Recibe {htg(0)} · los montos se calculan al tipo de cambio del momento del envío.
      </p>
    </div>
  );
}
