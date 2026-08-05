import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { mxn, htg, shortDate, STATUS_LABEL, STATUS_TONE, type TransferStatus } from "@/lib/remesa";

export const Route = createFileRoute("/_authenticated/agente")({
  head: () => ({
    meta: [
      { title: "Panel de agente — RemesaHaití" },
      { name: "description", content: "Confirma pagos, revisa comisiones y operaciones." },
      { property: "og:title", content: "Panel de agente — RemesaHaití" },
      { property: "og:description", content: "Solicitudes, pagos y comisiones del agente." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: allowed } = await supabase.rpc("has_role", {
      _user_id: data.user.id,
      _role: "agent",
    });
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: data.user.id,
      _role: "admin",
    });
    if (!allowed && !isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: Agente,
});

function Agente() {
  const qc = useQueryClient();

  const { data: transfers } = useQuery({
    queryKey: ["agent-transfers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("transfers")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(60);
      return data ?? [];
    },
  });

  const advance = async (id: string, status: TransferStatus, message: string) => {
    const now = new Date().toISOString();
    const patch = {
      status,
      ...(status === "paid" ? { paid_at: now } : {}),
      ...(status === "completed" ? { completed_at: now } : {}),
    };
    const { error } = await supabase.from("transfers").update(patch).eq("id", id);
    if (error) {
      toast.error("No se pudo actualizar");
      return;
    }
    toast.success(message);
    qc.invalidateQueries({ queryKey: ["agent-transfers"] });
  };

  const rows = transfers ?? [];
  const pending = rows.filter((t) => t.status === "awaiting_payment");
  const active = rows.filter((t) => ["paid", "processing", "ready_for_pickup"].includes(t.status));
  const done = rows.filter((t) => t.status === "completed");
  const commissions = done.reduce((a, t) => a + Number(t.agent_commission_mxn ?? 0), 0);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <h1 className="text-2xl font-bold">Panel de agente</h1>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Solicitudes por confirmar" value={String(pending.length)} />
        <Stat label="Operaciones activas" value={String(active.length)} />
        <Stat label="Comisiones acumuladas" value={mxn(commissions)} />
      </div>

      <Section title="Solicitudes de pago" rows={pending} advance={advance} />
      <Section title="En curso" rows={active} advance={advance} />
      <Section title="Historial de operaciones" rows={done} advance={advance} readOnly />
    </div>
  );
}

type Row = {
  id: string;
  reference: string;
  recipient_name: string;
  recipient_city: string;
  amount_mxn: number;
  amount_htg: number;
  agent_commission_mxn: number | null;
  status: string;
  created_at: string;
};

function Section({
  title,
  rows,
  advance,
  readOnly,
}: {
  title: string;
  rows: Row[];
  advance: (id: string, status: TransferStatus, message: string) => Promise<void>;
  readOnly?: boolean;
}) {
  const next: Partial<Record<TransferStatus, { to: TransferStatus; label: string }>> = {
    awaiting_payment: { to: "paid", label: "Confirmar pago" },
    paid: { to: "processing", label: "Procesar" },
    processing: { to: "ready_for_pickup", label: "Listo para retirar" },
    ready_for_pickup: { to: "completed", label: "Marcar entregado" },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && <p className="py-4 text-sm text-muted-foreground">Nada por aquí.</p>}
        {rows.map((t) => {
          const step = next[t.status as TransferStatus];
          return (
            <div
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
            >
              <div>
                <p className="font-medium">
                  {t.recipient_name} · {t.recipient_city}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.reference} · {shortDate(t.created_at)} · comisión{" "}
                  {mxn(Number(t.agent_commission_mxn ?? 0))}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{mxn(Number(t.amount_mxn))}</p>
                <p className="text-xs text-muted-foreground">{htg(Number(t.amount_htg))}</p>
              </div>
              <Badge className={STATUS_TONE[t.status as TransferStatus]} variant="secondary">
                {STATUS_LABEL[t.status as TransferStatus]}
              </Badge>
              {!readOnly && step && (
                <Button size="sm" onClick={() => void advance(t.id, step.to, step.label)}>
                  {step.label}
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="mt-1 font-display text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
