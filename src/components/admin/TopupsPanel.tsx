import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { money, shortDate } from "@/lib/remesa";

const TOPUP_STATUSES = ["pending", "processing", "completed", "failed", "refunded"] as const;
type TopupStatus = (typeof TOPUP_STATUSES)[number];

const LABEL: Record<TopupStatus, string> = {
  pending: "Pendiente",
  processing: "Procesando",
  completed: "Completada",
  failed: "Fallida",
  refunded: "Reembolsada",
};

const TONE: Record<TopupStatus, string> = {
  pending: "bg-warning/15 text-warning",
  processing: "bg-accent/15 text-accent",
  completed: "bg-success/15 text-success",
  failed: "bg-destructive/15 text-destructive",
  refunded: "bg-muted text-muted-foreground",
};

export function TopupsPanel() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | TopupStatus>("all");
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-topups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("topups")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((t) => {
      if (filter !== "all" && t.status !== filter) return false;
      if (!q) return true;
      return [t.reference, t.phone, t.operator, t.sku_code, t.provider_ref]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [data, search, filter]);

  const change = async (id: string, status: TopupStatus) => {
    setBusy(id);
    const { error } = await supabase.rpc("admin_set_topup_status", {
      _topup_id: id,
      _status: status,
    });
    setBusy(null);
    if (error) {
      toast.error(error.message || "No se pudo actualizar la recarga");
      return;
    }
    toast.success("Recarga actualizada");
    qc.invalidateQueries({ queryKey: ["admin-topups"] });
  };

  const pending = (data ?? []).filter((t) => t.status === "pending").length;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Recargas móviles</CardTitle>
          <Badge variant="secondary">{pending} pendientes</Badge>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
          <Input
            placeholder="Buscar por referencia, teléfono u operador"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {TOPUP_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Cargando recargas…</p>}
        {!isLoading && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay recargas para este filtro.</p>
        )}
        {rows.map((t) => (
          <div
            key={t.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
          >
            <div className="min-w-0">
              <p className="font-medium">
                {t.operator || "Operador"} · {t.phone}
              </p>
              <p className="text-xs text-muted-foreground">
                {t.reference} · {t.country_code} · {t.payment_method} · {shortDate(t.created_at)}
              </p>
              {t.status_detail && (
                <p className="text-xs text-muted-foreground">{t.status_detail}</p>
              )}
            </div>
            <p className="font-semibold">{money(Number(t.amount), t.currency)}</p>
            <Badge className={TONE[t.status as TopupStatus]} variant="secondary">
              {LABEL[t.status as TopupStatus] ?? t.status}
            </Badge>
            <Select
              value={t.status}
              disabled={busy === t.id}
              onValueChange={(v) => void change(t.id, v as TopupStatus)}
            >
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOPUP_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
