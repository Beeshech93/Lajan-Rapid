import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Check, Circle, Copy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  money,
  shortDate,
  STATUS_LABEL,
  STATUS_TONE,
  STATUS_FLOW,
  paymentLabel,
  deliveryLabel,
  type TransferStatus,
} from "@/lib/remesa";

export const Route = createFileRoute("/_authenticated/transferencia/$id")({
  head: () => ({
    meta: [
      { title: "Detalle del envío — RemesaHaití" },
      { name: "description", content: "Sigue en tiempo real el estado de tu envío a Haití." },
      { property: "og:title", content: "Detalle del envío — RemesaHaití" },
      { property: "og:description", content: "Seguimiento en tiempo real de tu remesa." },
    ],
  }),
  component: Detalle,
});

function Detalle() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const { data: t } = useQuery({
    queryKey: ["transfer", id],
    queryFn: async () => {
      const { data } = await supabase.from("transfers").select("*").eq("id", id).maybeSingle();
      return data;
    },
  });

  const { data: events } = useQuery({
    queryKey: ["transfer-events", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("transfer_events")
        .select("*")
        .eq("transfer_id", id)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`transfer-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transfers", filter: `id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["transfer", id] });
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transfer_events", filter: `transfer_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["transfer-events", id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, qc]);

  if (!t) return <p className="py-10 text-center text-sm text-muted-foreground">Cargando…</p>;

  const status = t.status as TransferStatus;
  const currentIndex = STATUS_FLOW.indexOf(status);
  const paymentName = paymentLabel(t.payment_method);
  const deliveryName = deliveryLabel(t.delivery_method);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Envío {t.reference}</h1>
          <p className="text-sm text-muted-foreground">Creado el {shortDate(t.created_at)}</p>
        </div>
        <Badge className={STATUS_TONE[status]} variant="secondary">
          {STATUS_LABEL[status]}
        </Badge>
      </div>

      <Card className="bg-brand text-primary-foreground">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
          <Metric label="Tú pagas" value={money(Number(t.total_send), t.send_currency)} />
          <Metric label="Comisión" value={money(Number(t.fee_send), t.send_currency)} />
          <Metric
            label={`${t.recipient_name} recibe`}
            value={money(Number(t.amount_receive), t.receive_currency)}
          />
        </CardContent>
      </Card>

      {status === "awaiting_payment" && (
        <Card className="border-warning/40 bg-warning/10">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-semibold">Completa tu pago con {paymentName}</p>
              <p className="text-sm text-muted-foreground">
                Usa la referencia {t.reference}. Un agente confirmará el pago.
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="gap-2"
              onClick={() => {
                void navigator.clipboard.writeText(t.reference);
                toast.success("Referencia copiada");
              }}
            >
              <Copy className="size-4" /> Copiar referencia
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Seguimiento en tiempo real</CardTitle>
        </CardHeader>
        <CardContent>
          {status === "cancelled" ? (
            <p className="text-sm text-destructive">Este envío fue cancelado.</p>
          ) : (
            <ol className="space-y-4">
              {STATUS_FLOW.map((s, i) => {
                const done = i <= currentIndex;
                return (
                  <li key={s} className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${
                        done ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {done ? <Check className="size-3.5" /> : <Circle className="size-2.5" />}
                    </span>
                    <div>
                      <p className={done ? "font-medium" : "text-muted-foreground"}>
                        {STATUS_LABEL[s]}
                      </p>
                      {events
                        ?.filter((e) => e.status === s)
                        .map((e) => (
                          <p key={e.id} className="text-xs text-muted-foreground">
                            {shortDate(e.created_at)} · {e.message}
                          </p>
                        ))}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Destinatario" value={t.recipient_name} />
          <Row label="Teléfono" value={t.recipient_phone} />
          <Row label="Ciudad" value={t.recipient_city} />
          <Row label="Entrega" value={deliveryName} />
          <Row label="Corredor" value={`${t.origin_country} → ${t.destination_country}`} />
          <Row label="Método de pago" value={paymentName} />
          <Row label="Tipo de cambio" value={`1 ${t.send_currency} = ${Number(t.rate).toFixed(4)} ${t.receive_currency}`} />
          {t.note && <Row label="Mensaje" value={t.note} />}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs opacity-80">{label}</p>
      <p className="font-display text-xl font-bold">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
