import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import {
  adminCancelTransfer,
  adminConfirmTransfer,
  adminSetTransferStatus,
} from "@/lib/transfers.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { STATUS_LABEL, STATUS_TONE, money, shortDate, type TransferStatus } from "@/lib/remesa";

const ALL_STATUSES: TransferStatus[] = [
  "created",
  "awaiting_payment",
  "paid",
  "processing",
  "ready_for_pickup",
  "completed",
  "cancelled",
];

export const Route = createFileRoute("/_authenticated/agente")({
  head: () => ({
    meta: [
      { title: "Panel de agente — Lajan Rapid" },
      { name: "description", content: "Confirma pagos, revisa comisiones y operaciones." },
      { property: "og:title", content: "Panel de agente — Lajan Rapid" },
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
  const { isAdmin } = useProfile();
  const qc = useQueryClient();
  const confirmTransfer = useServerFn(adminConfirmTransfer);
  const setStatus = useServerFn(adminSetTransferStatus);
  const cancelTransfer = useServerFn(adminCancelTransfer);

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
    try {
      const result = await confirmTransfer({ data: { transferId: id } });
      if (result.ok) {
        toast.success(result.message || message);
        qc.invalidateQueries({ queryKey: ["agent-transfers"] });
      } else {
        toast.error("No se pudo actualizar");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al procesar");
    }
  };

  const changeStage = async (id: string, status: TransferStatus) => {
    try {
      const result = await setStatus({ data: { transferId: id, status } });
      toast.success(result.message);
      qc.invalidateQueries({ queryKey: ["agent-transfers"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar la etapa");
    }
  };

  const cancel = async (id: string, reason: string) => {
    try {
      const result = await cancelTransfer({
        data: { transferId: id, reason: reason || undefined },
      });
      toast.success(result.message);
      qc.invalidateQueries({ queryKey: ["agent-transfers"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cancelar");
    }
  };

  const rows = transfers ?? [];
  const pending = rows.filter((t) => t.status === "awaiting_payment");
  const active = rows.filter((t) => t.status === "processing");
  const done = rows.filter((t) => t.status === "completed");
  const commissions = done.reduce(
    (acc, t) => {
      const cur = t.send_currency;
      acc[cur] = (acc[cur] ?? 0) + Number(t.agent_commission_send ?? 0);
      return acc;
    },
    {} as Record<string, number>,
  );
  const commissionsLabel =
    Object.keys(commissions).length === 0
      ? "—"
      : Object.entries(commissions)
          .map(([cur, val]) => money(val, cur))
          .join(" · ");

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <h1 className="text-2xl font-bold">Panel de agente</h1>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Solicitudes por confirmar" value={String(pending.length)} />
        <Stat label="Operaciones activas" value={String(active.length)} />
        <Stat label="Comisiones acumuladas" value={commissionsLabel} />
      </div>

      <Section
        title="Solicitudes de pago"
        rows={pending}
        advance={advance}
        changeStage={changeStage}
        cancel={cancel}
        isAdmin={isAdmin}
      />
      <Section
        title="En curso"
        rows={active}
        advance={advance}
        changeStage={changeStage}
        cancel={cancel}
        isAdmin={isAdmin}
      />
      <Section
        title="Historial de operaciones"
        rows={done}
        advance={advance}
        changeStage={changeStage}
        cancel={cancel}
        readOnly
      />
    </div>
  );
}

type Row = {
  id: string;
  reference: string;
  recipient_name: string;
  recipient_city: string;
  amount_send: number;
  amount_receive: number;
  send_currency: string;
  receive_currency: string;
  origin_country: string;
  destination_country: string;
  agent_commission_send: number | null;
  status: string;
  created_at: string;
};

function Section({
  title,
  rows,
  advance,
  changeStage,
  cancel,
  readOnly,
  isAdmin,
}: {
  title: string;
  rows: Row[];
  advance: (id: string, status: TransferStatus, message: string) => Promise<void>;
  changeStage: (id: string, status: TransferStatus) => Promise<void>;
  cancel: (id: string, reason: string) => Promise<void>;
  readOnly?: boolean;
  isAdmin?: boolean;
}) {
  const adminActions: Partial<Record<TransferStatus, { to: TransferStatus; label: string }>> = {
    awaiting_payment: { to: "processing", label: "Confirmar pago" },
    processing: { to: "completed", label: "Confirmar entregado" },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && <p className="py-4 text-sm text-muted-foreground">Nada por aquí.</p>}
        {rows.map((t) => {
          const step = isAdmin ? adminActions[t.status as TransferStatus] : undefined;
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
                  {t.reference} · {t.origin_country} → {t.destination_country} ·{" "}
                  {shortDate(t.created_at)} · comisión{" "}
                  {money(Number(t.agent_commission_send ?? 0), t.send_currency)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{money(Number(t.amount_send), t.send_currency)}</p>
                <p className="text-xs text-muted-foreground">
                  {money(Number(t.amount_receive), t.receive_currency)}
                </p>
              </div>
              <Badge className={STATUS_TONE[t.status as TransferStatus]} variant="secondary">
                {STATUS_LABEL[t.status as TransferStatus]}
              </Badge>
              {isAdmin && step && (
                <Button size="sm" onClick={() => void advance(t.id, step.to, step.label)}>
                  {step.label}
                </Button>
              )}
              {isAdmin && (
                <Select
                  value={t.status}
                  onValueChange={(value) => void changeStage(t.id, value as TransferStatus)}
                >
                  <SelectTrigger className="h-8 w-[150px] text-xs">
                    <SelectValue placeholder="Cambiar etapa" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {isAdmin && t.status !== "cancelled" && t.status !== "completed" && (
                <CancelButton
                  reference={t.reference}
                  onConfirm={(reason) => cancel(t.id, reason)}
                />
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function CancelButton({
  reference,
  onConfirm,
}: {
  reference: string;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="destructive" className="gap-1">
          <XCircle className="size-4" /> Cancelar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar el envío {reference}</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción marcará el envío como cancelado y notificará al usuario. No se puede
            deshacer desde aquí.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          placeholder="Motivo de la cancelación (opcional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setReason("")}>Volver</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              void onConfirm(reason);
              setReason("");
            }}
          >
            Sí, cancelar envío
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
