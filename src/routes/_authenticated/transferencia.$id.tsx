import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, Circle, Copy, Landmark, Loader2, Store } from "lucide-react";
import { toast } from "sonner";
import { celebrateLogo } from "@/components/LogoAnimation";
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
import { stripeInitiatePayment } from "@/lib/stripe.functions";
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
import { interpolate, useI18n } from "@/lib/i18n";

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
  const { t: t2 } = useI18n();
  const STATUS_LABEL_T: Record<TransferStatus, string> = {
    created: t2("history.status_created"),
    awaiting_payment: t2("history.status_awaiting_payment"),
    paid: t2("history.status_paid"),
    processing: t2("history.status_processing"),
    ready_for_pickup: t2("history.status_ready_for_pickup"),
    completed: t2("history.status_completed"),
    cancelled: t2("history.status_cancelled"),
  };
  const initiatePayment = useServerFn(mercadoPagoInitiatePayment);
  const initiateStripePayment = useServerFn(stripeInitiatePayment);
  const finalizePayout = useServerFn(finalizeTransferPayout);
  const [isInitiating, setIsInitiating] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  const finalize = useMutation({
    mutationFn: () => finalizePayout({ data: { transferId: id } }),
    onSuccess: () => {
      toast.success(t2("detail.success_complete"));
      celebrateLogo();
      void qc.invalidateQueries({ queryKey: ["transfer", id] });
      void qc.invalidateQueries({ queryKey: ["transfer-events", id] });
    },
    onError: (err: Error) => toast.error(err.message || t2("detail.err_complete")),
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
  const isStripePayment = isCardPayment && t?.origin_country !== "MX";
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

  if (!t)
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">{t2("detail.loading")}</p>
    );

  const definiteStatus = t.status as TransferStatus;
  const currentIndex = STATUS_FLOW.indexOf(definiteStatus);
  const paymentName = paymentLabel(t.payment_method);
  const deliveryName = deliveryLabel(t.delivery_method);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {t2("detail.title")} {t.reference}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t2("detail.created_on")} {shortDate(t.created_at)}
          </p>
        </div>
        <Badge className={STATUS_TONE[definiteStatus]} variant="secondary">
          {STATUS_LABEL_T[definiteStatus]}
        </Badge>
      </div>

      <Card className="bg-brand text-primary-foreground">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
          <Metric
            label={t2("detail.you_pay")}
            value={money(Number(t.total_send), t.send_currency)}
          />
          <Metric label={t2("detail.fee")} value={money(Number(t.fee_send), t.send_currency)} />
          <Metric
            label={`${t.recipient_name} ${t2("detail.recipient_gets")}`}
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
                  ? `${t2("detail.complete_payment")} ${paymentName}`
                  : isDirectCashDelivery && !isAdmin
                    ? `${t2("detail.processing_to")} ${deliveryName}...`
                    : `${t2("detail.finalize_to")} ${deliveryName}`}
              </p>
              <p className="text-sm text-muted-foreground">
                {isCardPayment
                  ? isStripePayment
                    ? t2("detail.stripe_note")
                    : t2("detail.mp_note")
                  : isDirectCashDelivery && !isAdmin
                    ? t2("detail.processing_note")
                    : `${t.recipient_name} · ${t.recipient_phone} · ${money(Number(t.amount_receive), t.receive_currency)}`}
              </p>
            </div>
            {isCardPayment ? (
              checkoutUrl ? (
                <Button size="sm" className="gap-2" asChild>
                  <a href={checkoutUrl} target="_blank" rel="noreferrer">
                    {t2("detail.go_pay")}
                  </a>
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="gap-2"
                  disabled={isInitiating}
                  onClick={async () => {
                    setIsInitiating(true);
                    try {
                      const result = isStripePayment
                        ? await initiateStripePayment({ data: { transferId: id } })
                        : await initiatePayment({ data: { transferId: id } });
                      setCheckoutUrl(result.checkoutUrl);
                    } catch (err) {
                      toast.error((err as Error).message || t2("detail.err_pay_start"));
                    } finally {
                      setIsInitiating(false);
                    }
                  }}
                >
                  {isInitiating && <Loader2 className="size-4 animate-spin" />}
                  {isInitiating
                    ? t2("detail.loading_short")
                    : isStripePayment
                      ? t2("detail.pay_card")
                      : t2("detail.go_mp")}
                </Button>
              )
            ) : !isAdmin && isDirectCashDelivery ? (
              <Button
                size="sm"
                className="gap-2"
                disabled={finalize.isPending}
                onClick={() => finalize.mutate()}
              >
                {finalize.isPending && <Loader2 className="size-4 animate-spin" />}
                {finalize.isPending ? t2("detail.sending") : t2("detail.retry_send")}
              </Button>
            ) : (
              <Button
                size="sm"
                className="gap-2"
                disabled={finalize.isPending}
                onClick={() => finalize.mutate()}
              >
                {finalize.isPending && <Loader2 className="size-4 animate-spin" />}
                {finalize.isPending
                  ? t2("detail.sending")
                  : `${t2("detail.send_to")} ${deliveryName}`}
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
          <CardTitle className="text-base">{t2("detail.tracking")}</CardTitle>
        </CardHeader>
        <CardContent>
          {status === "cancelled" ? (
            <p className="text-sm text-destructive">{t2("detail.cancelled")}</p>
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
                        {STATUS_LABEL_T[s]}
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
          <CardTitle className="text-base">{t2("detail.details")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label={t2("detail.recipient")} value={t.recipient_name} />
          <Row label={t2("detail.phone")} value={t.recipient_phone} />
          <Row label={t2("detail.city")} value={t.recipient_city} />
          <Row label={t2("detail.delivery")} value={deliveryName} />
          <Row
            label={t2("detail.corridor")}
            value={`${t.origin_country} → ${t.destination_country}`}
          />
          <Row label={t2("detail.payment_method")} value={paymentName} />
          <Row
            label={t2("detail.rate")}
            value={`1 ${t.send_currency} = ${Number(t.rate).toFixed(4)} ${t.receive_currency}`}
          />
          {t.note && <Row label={t2("detail.message")} value={t.note} />}
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
  const { t } = useI18n();
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
        <CardTitle className="text-base">{t("detail.oxxo_title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isPending && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> {t("detail.oxxo_generating")}
          </p>
        )}

        {isError && (
          <div className="space-y-3">
            <p className="text-sm text-destructive">
              {(error as Error).message || t("detail.oxxo_err")}
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              {t("detail.retry")}
            </Button>
          </div>
        )}

        {data && (
          <>
            <div className="rounded-xl bg-secondary p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                {t("detail.oxxo_reference")}
              </p>
              <p className="mt-1 break-all font-display text-2xl font-bold tracking-wider">
                {data.reference}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("detail.amount_to_pay")}:{" "}
                <span className="font-semibold text-foreground">{amount}</span>
              </p>
            </div>

            <p className={`text-sm ${expired ? "text-destructive" : "text-muted-foreground"}`}>
              {expires
                ? expired
                  ? interpolate(t("detail.expired_oxxo"), { date: expires.toLocaleString("es-MX") })
                  : interpolate(t("detail.expires"), {
                      date: expires.toLocaleString("es-MX", {
                        dateStyle: "long",
                        timeStyle: "short",
                      }),
                    })
                : t("detail.no_expiry")}
            </p>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => {
                  void navigator.clipboard.writeText(data.reference);
                  toast.success(t("detail.reference_copied"));
                }}
              >
                <Copy className="size-4" /> {t("detail.copy_reference")}
              </Button>
              {data.voucherUrl && (
                <Button size="sm" className="gap-2" asChild>
                  <a href={data.voucherUrl} target="_blank" rel="noreferrer">
                    {t("detail.view_receipt")}
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
                  {t("detail.new_voucher")}
                </Button>
              )}
            </div>

            <p className="text-xs text-muted-foreground">{t("detail.oxxo_note")}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SpeiCard({ transferId, amount }: { transferId: string; amount: string }) {
  const { t } = useI18n();
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
        <CardTitle className="text-base">{t("detail.spei_title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isPending && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> {t("detail.spei_generating")}
          </p>
        )}

        {isError && (
          <div className="space-y-3">
            <p className="text-sm text-destructive">
              {(error as Error).message || t("detail.spei_err")}
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              {t("detail.retry")}
            </Button>
          </div>
        )}

        {data && (
          <>
            <div className="rounded-xl bg-secondary p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                {t("detail.clabe_label")}
              </p>
              <p className="mt-1 break-all font-display text-2xl font-bold tracking-wider">
                {data.clabe}
              </p>
              {data.bank && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("detail.receiving_bank")}: {data.bank}
                </p>
              )}
              <p className="mt-2 text-sm text-muted-foreground">
                {t("detail.concept")}:{" "}
                <span className="font-semibold text-foreground">{data.concept}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {t("detail.exact_amount")}:{" "}
                <span className="font-semibold text-foreground">{amount}</span>
              </p>
            </div>

            <p className={`text-sm ${expired ? "text-destructive" : "text-muted-foreground"}`}>
              {expires
                ? expired
                  ? interpolate(t("detail.expired_spei"), { date: expires.toLocaleString("es-MX") })
                  : interpolate(t("detail.expires"), {
                      date: expires.toLocaleString("es-MX", {
                        dateStyle: "long",
                        timeStyle: "short",
                      }),
                    })
                : t("detail.no_expiry")}
            </p>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => {
                  void navigator.clipboard.writeText(data.clabe);
                  toast.success(t("detail.clabe_copied"));
                }}
              >
                <Copy className="size-4" /> {t("detail.copy_clabe")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => {
                  void navigator.clipboard.writeText(data.concept);
                  toast.success(t("detail.concept_copied"));
                }}
              >
                <Copy className="size-4" /> {t("detail.copy_concept")}
              </Button>
              {data.voucherUrl && (
                <Button size="sm" className="gap-2" asChild>
                  <a href={data.voucherUrl} target="_blank" rel="noreferrer">
                    {t("detail.view_instructions")}
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
                  {t("detail.new_clabe")}
                </Button>
              )}
            </div>

            <p className="text-xs text-muted-foreground">{t("detail.spei_note")}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
