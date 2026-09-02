import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, Circle, Copy, Landmark, Loader2, Store } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  mercadoPagoInitiatePayment,
  mercadoPagoOxxoVoucher,
  mercadoPagoSpeiReference,
} from "@/lib/mercadopago.functions";
import { finalizeTransferPayout } from "@/lib/transfers.functions";
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
      { title: "Detalle del envío — Lajan Rapid" },
      { name: "description", content: "Sigue en tiempo real el estado de tu envío a Haití." },
      { property: "og:title", content: "Detalle del envío — Lajan Rapid" },
      { property: "og:description", content: "Seguimiento en tiempo real de tu remesa." },
    ],
  }),
  component: Detalle,
});

function Detalle() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { isAdmin } = useProfile();
  const initiatePayment = useServerFn(mercadoPagoInitiatePayment);
  const finalizePayout = useServerFn(finalizeTransferPayout);
  const [isInitiating, setIsInitiating] = useState(false);

  const finalize = useMutation({
    mutationFn: () => finalizePayout({ data: { transferId: id } }),
    onSuccess: () => {
      toast.success("Envío completado");
      void qc.invalidateQueries({ queryKey: ["transfer", id] });
      void qc.invalidateQueries({ queryKey: ["transfer-events", id] });
    },
    onError: (err: Error) => toast.error(err.message || "No pudimos completar el envío"),
  });

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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transfers", filter: `id=eq.${id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["transfer", id] });
        },
      )
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

  const status = t?.status as TransferStatus | undefined;
  const isCardPayment = t
    ? ["mercado_pago", "mercadopago", "card", "tarjeta"].includes(t.payment_method)
    : false;
  const isOxxo = t?.payment_method === "oxxo";
  const isSpei = t?.payment_method === "spei";
  const isDirectCashDelivery = t ? ["moncash", "natcash"].includes(t.delivery_method) : false;
  const shouldAutoFinalizeUser =
    !isAdmin && isDirectCashDelivery && !isCardPayment && !isOxxo && !isSpei;

  useEffect(() => {
    if (!t) return;
    if (!shouldAutoFinalizeUser) return;
    if (status === "completed" || status === "cancelled") return;
    if (finalize.isPending) return;
    finalize.mutate();
  }, [finalize, shouldAutoFinalizeUser, status, t]);

  if (!t) return <p className="py-10 text-center text-sm text-muted-foreground">Cargando…</p>;

  const definiteStatus = t.status as TransferStatus;
  const currentIndex = STATUS_FLOW.indexOf(definiteStatus);
  const paymentName = paymentLabel(t.payment_method);
  const deliveryName = deliveryLabel(t.delivery_method);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Envío {t.reference}</h1>
          <p className="text-sm text-muted-foreground">Creado el {shortDate(t.created_at)}</p>
        </div>
        <Badge className={STATUS_TONE[definiteStatus]} variant="secondary">
          {STATUS_LABEL[definiteStatus]}
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

      {status !== "completed" && status !== "cancelled" && !isOxxo && !isSpei && (
        <Card className="border-warning/40 bg-warning/10">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-semibold">
                {isCardPayment
                  ? `Completa tu pago con ${paymentName}`
                  : isDirectCashDelivery && !isAdmin
                    ? `Procesando envío a ${deliveryName}...`
                    : `Finalizar envío por ${deliveryName}`}
              </p>
              <p className="text-sm text-muted-foreground">
                {isCardPayment
                  ? "Serás redirigido a Mercado Pago para completar el pago."
                  : isDirectCashDelivery && !isAdmin
                    ? "Tu pago está siendo enviado directamente al destinatario por Bazik."
                    : `${t.recipient_name} · ${t.recipient_phone} · ${money(Number(t.amount_receive), t.receive_currency)}`}
              </p>
            </div>
            {isCardPayment ? (
              <Button
                size="sm"
                className="gap-2"
                disabled={isInitiating}
                onClick={async () => {
                  setIsInitiating(true);
                  try {
                    const result = await initiatePayment({ data: { transferId: id } });
                    window.location.href = result.checkoutUrl;
                  } catch (err) {
                    toast.error((err as Error).message || "Error al iniciar el pago");
                    setIsInitiating(false);
                  }
                }}
              >
                {isInitiating && <Loader2 className="size-4 animate-spin" />}
                {isInitiating ? "Cargando..." : "Ir a Mercado Pago"}
              </Button>
            ) : !isAdmin && isDirectCashDelivery ? (
              <Button
                size="sm"
                className="gap-2"
                disabled={finalize.isPending}
                onClick={() => finalize.mutate()}
              >
                {finalize.isPending && <Loader2 className="size-4 animate-spin" />}
                {finalize.isPending ? "Enviando…" : "Reintentar envío"}
              </Button>
            ) : (
              <Button
                size="sm"
                className="gap-2"
                disabled={finalize.isPending}
                onClick={() => finalize.mutate()}
              >
                {finalize.isPending && <Loader2 className="size-4 animate-spin" />}
                {finalize.isPending ? "Enviando…" : `Enviar a ${deliveryName}`}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {isOxxo && status !== "completed" && status !== "cancelled" && (
        <OxxoVoucherCard transferId={id} amount={money(Number(t.total_send), t.send_currency)} />
      )}

      {isSpei && status !== "completed" && status !== "cancelled" && (
        <SpeiCard transferId={id} amount={money(Number(t.total_send), t.send_currency)} />
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
          <Row
            label="Tipo de cambio"
            value={`1 ${t.send_currency} = ${Number(t.rate).toFixed(4)} ${t.receive_currency}`}
          />
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

function OxxoVoucherCard({ transferId, amount }: { transferId: string; amount: string }) {
  const getVoucher = useServerFn(mercadoPagoOxxoVoucher);
  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["oxxo-voucher", transferId],
    queryFn: () => getVoucher({ data: { transferId } }),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const expires = data?.expiresAt ? new Date(data.expiresAt) : null;
  const expired = expires ? expires.getTime() < Date.now() : false;

  return (
    <Card className="border-accent/40">
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Store className="size-4 text-accent" />
        <CardTitle className="text-base">Ficha de pago en OXXO</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isPending && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Generando tu referencia…
          </p>
        )}

        {isError && (
          <div className="space-y-3">
            <p className="text-sm text-destructive">
              {(error as Error).message || "No pudimos generar la ficha."}
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              Reintentar
            </Button>
          </div>
        )}

        {data && (
          <>
            <div className="rounded-xl bg-secondary p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Referencia OXXO
              </p>
              <p className="mt-1 break-all font-display text-2xl font-bold tracking-wider">
                {data.reference}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Monto a pagar: <span className="font-semibold text-foreground">{amount}</span>
              </p>
            </div>

            <p className={`text-sm ${expired ? "text-destructive" : "text-muted-foreground"}`}>
              {expires
                ? expired
                  ? `La ficha venció el ${expires.toLocaleString("es-MX")}. Genera una nueva.`
                  : `Vence el ${expires.toLocaleString("es-MX", {
                      dateStyle: "long",
                      timeStyle: "short",
                    })}`
                : "Sin fecha de vencimiento informada."}
            </p>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => {
                  void navigator.clipboard.writeText(data.reference);
                  toast.success("Referencia copiada");
                }}
              >
                <Copy className="size-4" /> Copiar referencia
              </Button>
              {data.voucherUrl && (
                <Button size="sm" className="gap-2" asChild>
                  <a href={data.voucherUrl} target="_blank" rel="noreferrer">
                    Ver comprobante
                  </a>
                </Button>
              )}
              {expired && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={isFetching}
                  onClick={() => void refetch()}
                >
                  Generar nueva ficha
                </Button>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Muestra esta referencia en cualquier tienda OXXO. Tu envío se activa automáticamente
              en cuanto la tienda reporta el pago (puede tardar unos minutos).
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SpeiCard({ transferId, amount }: { transferId: string; amount: string }) {
  const getSpei = useServerFn(mercadoPagoSpeiReference);
  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["spei-reference", transferId],
    queryFn: () => getSpei({ data: { transferId } }),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const expires = data?.expiresAt ? new Date(data.expiresAt) : null;
  const expired = expires ? expires.getTime() < Date.now() : false;

  return (
    <Card className="border-accent/40">
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Landmark className="size-4 text-accent" />
        <CardTitle className="text-base">Transferencia SPEI</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isPending && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Generando tu CLABE…
          </p>
        )}

        {isError && (
          <div className="space-y-3">
            <p className="text-sm text-destructive">
              {(error as Error).message || "No pudimos generar la CLABE."}
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              Reintentar
            </Button>
          </div>
        )}

        {data && (
          <>
            <div className="rounded-xl bg-secondary p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                CLABE interbancaria
              </p>
              <p className="mt-1 break-all font-display text-2xl font-bold tracking-wider">
                {data.clabe}
              </p>
              {data.bank && (
                <p className="mt-1 text-sm text-muted-foreground">Banco receptor: {data.bank}</p>
              )}
              <p className="mt-2 text-sm text-muted-foreground">
                Concepto: <span className="font-semibold text-foreground">{data.concept}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Monto exacto: <span className="font-semibold text-foreground">{amount}</span>
              </p>
            </div>

            <p className={`text-sm ${expired ? "text-destructive" : "text-muted-foreground"}`}>
              {expires
                ? expired
                  ? `La CLABE venció el ${expires.toLocaleString("es-MX")}. Genera una nueva.`
                  : `Vence el ${expires.toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" })}`
                : "Sin fecha de vencimiento informada."}
            </p>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => {
                  void navigator.clipboard.writeText(data.clabe);
                  toast.success("CLABE copiada");
                }}
              >
                <Copy className="size-4" /> Copiar CLABE
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => {
                  void navigator.clipboard.writeText(data.concept);
                  toast.success("Concepto copiado");
                }}
              >
                <Copy className="size-4" /> Copiar concepto
              </Button>
              {data.voucherUrl && (
                <Button size="sm" className="gap-2" asChild>
                  <a href={data.voucherUrl} target="_blank" rel="noreferrer">
                    Ver instrucciones
                  </a>
                </Button>
              )}
              {expired && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={isFetching}
                  onClick={() => void refetch()}
                >
                  Generar nueva CLABE
                </Button>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Haz la transferencia desde tu banca en línea por el monto exacto. Tu envío se activa
              automáticamente en cuanto el banco confirma el depósito.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
