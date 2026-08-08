import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { money, shortDate, STATUS_LABEL, STATUS_TONE, type TransferStatus } from "@/lib/remesa";

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
  const [q, setQ] = useState("");

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
    (t) =>
      !term ||
      t.recipient_name.toLowerCase().includes(term) ||
      t.reference.toLowerCase().includes(term),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-2xl font-bold">Historial</h1>
      <Input
        placeholder="Buscar por destinatario o referencia"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        maxLength={60}
      />
      {rows.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">Sin resultados.</p>
      )}
      <div className="space-y-2">
        {rows.map((t) => (
          <Link key={t.id} to="/transferencia/$id" params={{ id: t.id }}>
            <Card className="transition-colors hover:bg-secondary">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{t.recipient_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.reference} · {t.recipient_city} · {shortDate(t.created_at)}
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
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
