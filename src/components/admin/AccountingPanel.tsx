import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, TrendingUp, Coins, Users, Wallet } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { money } from "@/lib/remesa";

type Row = {
  created_at: string;
  status: string;
  send_currency: string;
  receive_currency: string;
  amount_send: number;
  fee_send: number;
  total_send: number;
  amount_receive: number;
  agent_commission_send: number;
};

const PERIODS = [
  { value: "30", label: "Últimos 30 días" },
  { value: "90", label: "Últimos 90 días" },
  { value: "365", label: "Último año" },
  { value: "all", label: "Todo el histórico" },
];

const COUNTED = ["paid", "processing", "ready_for_pickup", "completed"];

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

export function AccountingPanel() {
  const [period, setPeriod] = useState("90");
  const [currency, setCurrency] = useState("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["accounting", period],
    queryFn: async () => {
      let q = supabase
        .from("transfers")
        .select(
          "created_at,status,send_currency,receive_currency,amount_send,fee_send,total_send,amount_receive,agent_commission_send",
        )
        .order("created_at", { ascending: false })
        .limit(5000);
      if (period !== "all") {
        const from = new Date(Date.now() - Number(period) * 86400000).toISOString();
        q = q.gte("created_at", from);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const currencies = useMemo(
    () => Array.from(new Set(rows.map((r) => r.send_currency))).sort(),
    [rows],
  );

  const filtered = useMemo(
    () => rows.filter((r) => currency === "all" || r.send_currency === currency),
    [rows, currency],
  );

  const settled = useMemo(() => filtered.filter((r) => COUNTED.includes(r.status)), [filtered]);

  const byCurrency = useMemo(() => {
    const map = new Map<
      string,
      { currency: string; volume: number; fees: number; agent: number; net: number; count: number }
    >();
    for (const r of settled) {
      const c = map.get(r.send_currency) ?? {
        currency: r.send_currency,
        volume: 0,
        fees: 0,
        agent: 0,
        net: 0,
        count: 0,
      };
      c.volume += Number(r.amount_send);
      c.fees += Number(r.fee_send);
      c.agent += Number(r.agent_commission_send);
      c.net = c.fees - c.agent;
      c.count += 1;
      map.set(r.send_currency, c);
    }
    return Array.from(map.values()).sort((a, b) => b.volume - a.volume);
  }, [settled]);

  const byMonth = useMemo(() => {
    const map = new Map<
      string,
      { month: string; currency: string; volume: number; fees: number; agent: number; count: number }
    >();
    for (const r of settled) {
      const key = `${monthKey(r.created_at)}|${r.send_currency}`;
      const c = map.get(key) ?? {
        month: monthKey(r.created_at),
        currency: r.send_currency,
        volume: 0,
        fees: 0,
        agent: 0,
        count: 0,
      };
      c.volume += Number(r.amount_send);
      c.fees += Number(r.fee_send);
      c.agent += Number(r.agent_commission_send);
      c.count += 1;
      map.set(key, c);
    }
    return Array.from(map.values()).sort(
      (a, b) => b.month.localeCompare(a.month) || a.currency.localeCompare(b.currency),
    );
  }, [settled]);

  const pending = filtered.filter((r) => r.status === "awaiting_payment" || r.status === "created");
  const cancelled = filtered.filter((r) => r.status === "cancelled");

  const exportCsv = () => {
    const head = "mes,moneda,operaciones,volumen,comisiones,comision_agentes,neto\n";
    const body = byMonth
      .map((m) =>
        [
          m.month,
          m.currency,
          m.count,
          m.volume.toFixed(2),
          m.fees.toFixed(2),
          m.agent.toFixed(2),
          (m.fees - m.agent).toFixed(2),
        ].join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([head + body], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `contabilidad-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={currency} onValueChange={setCurrency}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las monedas</SelectItem>
            {currencies.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="gap-2" onClick={exportCsv}>
          <Download className="size-4" /> Exportar CSV
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {byCurrency.length === 0 ? (
          <Kpi icon={TrendingUp} label="Volumen" value={isLoading ? "…" : "Sin datos"} />
        ) : (
          byCurrency.slice(0, 2).map((c) => (
            <Kpi
              key={c.currency}
              icon={TrendingUp}
              label={`Volumen ${c.currency}`}
              value={money(c.volume, c.currency)}
              hint={`${c.count} operaciones liquidadas`}
            />
          ))
        )}
        <Kpi
          icon={Coins}
          label="Ingresos por comisión"
          value={
            byCurrency.length
              ? byCurrency.map((c) => money(c.fees, c.currency)).join(" · ")
              : "—"
          }
          hint="Comisiones cobradas al cliente"
        />
        <Kpi
          icon={Users}
          label="Comisión de agentes"
          value={
            byCurrency.length
              ? byCurrency.map((c) => money(c.agent, c.currency)).join(" · ")
              : "—"
          }
          hint="Costo pagado a la red de agentes"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Resultado por moneda</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <Th>Moneda</Th>
                  <Th right>Ops.</Th>
                  <Th right>Volumen</Th>
                  <Th right>Comisiones</Th>
                  <Th right>Agentes</Th>
                  <Th right>Neto</Th>
                </tr>
              </thead>
              <tbody>
                {byCurrency.map((c) => (
                  <tr key={c.currency} className="border-b last:border-0">
                    <Td className="font-semibold">{c.currency}</Td>
                    <Td right>{c.count}</Td>
                    <Td right>{money(c.volume, c.currency)}</Td>
                    <Td right>{money(c.fees, c.currency)}</Td>
                    <Td right>{money(c.agent, c.currency)}</Td>
                    <Td right className="font-semibold text-success">
                      {money(c.fees - c.agent, c.currency)}
                    </Td>
                  </tr>
                ))}
                {byCurrency.length === 0 && (
                  <tr>
                    <Td className="py-6 text-center text-muted-foreground">
                      {isLoading ? "Cargando…" : "Aún no hay operaciones liquidadas en este periodo."}
                    </Td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Estado de la cartera</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <LineItem icon={Wallet} label="Envíos liquidados" value={String(settled.length)} />
            <LineItem icon={Wallet} label="Pendientes de pago" value={String(pending.length)} />
            <LineItem icon={Wallet} label="Cancelados" value={String(cancelled.length)} />
            <p className="pt-2 text-xs text-muted-foreground">
              Se consideran liquidados los envíos pagados, en proceso, listos para retiro y
              completados.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Libro mensual</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <Th>Mes</Th>
                <Th>Moneda</Th>
                <Th right>Ops.</Th>
                <Th right>Volumen</Th>
                <Th right>Comisiones</Th>
                <Th right>Agentes</Th>
                <Th right>Neto</Th>
              </tr>
            </thead>
            <tbody>
              {byMonth.map((m) => (
                <tr key={m.month + m.currency} className="border-b last:border-0">
                  <Td>{m.month}</Td>
                  <Td>{m.currency}</Td>
                  <Td right>{m.count}</Td>
                  <Td right>{money(m.volume, m.currency)}</Td>
                  <Td right>{money(m.fees, m.currency)}</Td>
                  <Td right>{money(m.agent, m.currency)}</Td>
                  <Td right className="font-semibold">
                    {money(m.fees - m.agent, m.currency)}
                  </Td>
                </tr>
              ))}
              {byMonth.length === 0 && (
                <tr>
                  <Td className="py-6 text-center text-muted-foreground">
                    {isLoading ? "Cargando…" : "Sin movimientos en este periodo."}
                  </Td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Coins;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <span className="grid size-9 place-items-center rounded-xl bg-accent/15 text-accent-foreground">
          <Icon className="size-4" />
        </span>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 font-display text-xl font-bold">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function LineItem({ icon: Icon, label, value }: { icon: typeof Wallet; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" /> {label}
      </span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <th className={`px-4 py-2.5 ${right ? "text-right" : "text-left"} font-semibold`}>{children}</th>;
}

function Td({
  children,
  right,
  className = "",
}: {
  children?: React.ReactNode;
  right?: boolean;
  className?: string;
}) {
  return <td className={`px-4 py-2.5 ${right ? "text-right" : ""} ${className}`}>{children}</td>;
}
