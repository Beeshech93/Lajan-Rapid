import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { money, shortDate, STATUS_TONE, type TransferStatus } from "@/lib/remesa";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/historial")({
  head: () => ({
    meta: [
      { title: "Historial de envíos — Lajan Rapid" },
      { name: "description", content: "Consulta todos tus envíos de dinero a Haití y su estado." },
      { property: "og:title", content: "Historial de envíos — Lajan Rapid" },
      { property: "og:description", content: "Todos tus envíos y su estado actual." },
    ],
  }),
  component: Historial,
});

function Historial() {
  const { user } = useProfile();
  const { t } = useI18n();
  const [q, setQ] = useState("");

  const STATUS_LABEL: Record<TransferStatus, string> = {
    created: t("history.status_created"),
    awaiting_payment: t("history.status_awaiting_payment"),
    paid: t("history.status_paid"),
    processing: t("history.status_processing"),
    ready_for_pickup: t("history.status_ready_for_pickup"),
    completed: t("history.status_completed"),
    cancelled: t("history.status_cancelled"),
  };

  const { data } = useQuery({
    queryKey: ["history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("transfers")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const term = q.trim().toLowerCase();
  const rows = (data ?? []).filter(
    (tr) =>
      !term ||
      tr.recipient_name.toLowerCase().includes(term) ||
      tr.reference.toLowerCase().includes(term),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-2xl font-bold">{t("history.title")}</h1>
      <Input
        placeholder={t("history.search_placeholder")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        maxLength={60}
      />
      {rows.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">{t("history.no_results")}</p>
      )}
      <div className="space-y-2">
        {rows.map((tr) => (
          <Link key={tr.id} to="/transferencia/$id" params={{ id: tr.id }}>
            <Card className="transition-colors hover:bg-secondary">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{tr.recipient_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {tr.reference} · {tr.recipient_city} · {shortDate(tr.created_at)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{money(Number(tr.amount_send), tr.send_currency)}</p>
                  <p className="text-xs text-muted-foreground">
                    {money(Number(tr.amount_receive), tr.receive_currency)}
                  </p>
                </div>
                <Badge className={STATUS_TONE[tr.status as TransferStatus]} variant="secondary">
                  {STATUS_LABEL[tr.status as TransferStatus]}
                </Badge>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
