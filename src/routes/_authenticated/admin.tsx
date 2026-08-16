import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCountries } from "@/hooks/useCorridors";
import { WalletsCardsPanel } from "@/components/admin/WalletsCardsPanel";
import { BazikPanel } from "@/components/admin/BazikPanel";
import { CardIssuerPanel } from "@/components/admin/CardIssuerPanel";
import { MercadoPagoPanel } from "@/components/admin/MercadoPagoPanel";
import { StripePanel } from "@/components/admin/StripePanel";
import { DingConnectPanel } from "@/components/admin/DingConnectPanel";
import { AccountingPanel } from "@/components/admin/AccountingPanel";
import { SupportPanel } from "@/components/admin/SupportPanel";
import {
  money,
  shortDate,
  STATUS_LABEL,
  STATUS_TONE,
  KYC_LABEL,
  KYC_TONE,
  type KycStatus,
  type TransferStatus,
} from "@/lib/remesa";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administración — Lajan Rapid" },
      { name: "description", content: "Gestiona usuarios, KYC, tipos de cambio y transacciones." },
      { property: "og:title", content: "Administración — Lajan Rapid" },
      { property: "og:description", content: "Panel de control de la operación de remesas." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: data.user.id,
      _role: "admin",
    });
    if (!isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: Admin,
});

function Admin() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <h1 className="text-2xl font-bold">Administración</h1>
      <Tabs defaultValue="resumen">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="contabilidad">Contabilidad</TabsTrigger>
          <TabsTrigger value="soporte">Soporte</TabsTrigger>
          <TabsTrigger value="bazik">Bazik API</TabsTrigger>
          <TabsTrigger value="mercadopago">Mercado Pago</TabsTrigger>
          <TabsTrigger value="stripe">Stripe</TabsTrigger>
          <TabsTrigger value="dingconnect">Recargas (Ding)</TabsTrigger>
          <TabsTrigger value="tarjetas-api">API tarjetas</TabsTrigger>
          <TabsTrigger value="kyc">KYC</TabsTrigger>
          <TabsTrigger value="tx">Transacciones</TabsTrigger>
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
          <TabsTrigger value="billeteras">Billeteras y tarjetas</TabsTrigger>
          <TabsTrigger value="tarifas">Tarifas</TabsTrigger>
        </TabsList>
        <TabsContent value="resumen" className="mt-4">
          <Resumen />
        </TabsContent>
        <TabsContent value="contabilidad" className="mt-4">
          <AccountingPanel />
        </TabsContent>
        <TabsContent value="soporte" className="mt-4">
          <SupportPanel />
        </TabsContent>
        <TabsContent value="kyc" className="mt-4">
          <KycPanel />
        </TabsContent>
        <TabsContent value="tx" className="mt-4">
          <TxPanel />
        </TabsContent>
        <TabsContent value="usuarios" className="mt-4">
          <UsersPanel />
        </TabsContent>
        <TabsContent value="billeteras" className="mt-4">
          <WalletsCardsPanel />
        </TabsContent>
        <TabsContent value="tarifas" className="mt-4">
          <RatesPanel />
        </TabsContent>
        <TabsContent value="bazik" className="mt-4">
          <BazikPanel />
        </TabsContent>
        <TabsContent value="tarjetas-api" className="mt-4">
          <CardIssuerPanel />
        </TabsContent>
        <TabsContent value="mercadopago" className="mt-4">
          <MercadoPagoPanel />
        </TabsContent>
        <TabsContent value="stripe" className="mt-4">
          <StripePanel />
        </TabsContent>
        <TabsContent value="dingconnect" className="mt-4">
          <DingConnectPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function useTransfers() {
  return useQuery({
    queryKey: ["admin-transfers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("transfers")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });
}

function Resumen() {
  const { data: transfers } = useTransfers();
  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => (await supabase.from("profiles").select("*")).data ?? [],
  });

  const rows = transfers ?? [];
  const sumBy = (pick: (t: (typeof rows)[number]) => number) => {
    const acc: Record<string, number> = {};
    rows.forEach((t) => {
      acc[t.send_currency] = (acc[t.send_currency] ?? 0) + pick(t);
    });
    const entries = Object.entries(acc);
    return entries.length ? entries.map(([c, v]) => money(v, c)).join(" · ") : "—";
  };
  const volume = sumBy((t) => Number(t.amount_send));
  const fees = sumBy((t) => Number(t.fee_send));
  const completed = rows.filter((t) => t.status === "completed").length;
  const pendingKyc = (profiles ?? []).filter((p) => p.kyc_status === "pending").length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Volumen total" value={volume} />
        <Stat label="Ingresos por comisión" value={fees} />
        <Stat label="Envíos entregados" value={`${completed} / ${rows.length}`} />
        <Stat label="KYC por revisar" value={String(pendingKyc)} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Envíos por estado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(Object.keys(STATUS_LABEL) as TransferStatus[]).map((s) => {
            const n = rows.filter((t) => t.status === s).length;
            const pct = rows.length ? Math.round((n / rows.length) * 100) : 0;
            return (
              <div key={s} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{STATUS_LABEL[s]}</span>
                  <span className="text-muted-foreground">
                    {n} ({pct}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-secondary">
                  <div className="h-2 rounded-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function KycPanel() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-kyc"],
    queryFn: async () =>
      (
        await supabase
          .from("kyc_submissions")
          .select("*")
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const review = async (id: string, userId: string, status: "approved" | "rejected") => {
    const notes = status === "rejected" ? "Documentación ilegible o incompleta." : null;
    const { error } = await supabase
      .from("kyc_submissions")
      .update({ status, review_notes: notes })
      .eq("id", id);
    if (!error) await supabase.from("profiles").update({ kyc_status: status }).eq("id", userId);
    if (error) {
      toast.error("No se pudo actualizar");
      return;
    }
    toast.success(status === "approved" ? "KYC aprobado" : "KYC rechazado");
    qc.invalidateQueries({ queryKey: ["admin-kyc"] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Solicitudes de verificación</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {(data ?? []).length === 0 && (
          <p className="py-4 text-sm text-muted-foreground">Sin solicitudes.</p>
        )}
        {(data ?? []).map((k) => (
          <div key={k.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
            <div>
              <p className="font-medium">
                {k.document_type.toUpperCase()} · {k.document_number}
              </p>
              <p className="text-xs text-muted-foreground">
                {k.address} · nac. {k.birth_date} · {shortDate(k.created_at)}
              </p>
            </div>
            <Badge className={KYC_TONE[k.status as KycStatus]} variant="secondary">
              {KYC_LABEL[k.status as KycStatus]}
            </Badge>
            {k.status === "pending" && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void review(k.id, k.user_id, "approved")}>
                  Aprobar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void review(k.id, k.user_id, "rejected")}
                >
                  Rechazar
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function TxPanel() {
  const { data } = useTransfers();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Todas las transacciones</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {(data ?? []).map((t) => (
          <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
            <div>
              <p className="font-medium">{t.recipient_name}</p>
              <p className="text-xs text-muted-foreground">
                {t.reference} · {t.origin_country} → {t.destination_country} ·{" "}
                {t.payment_method} · {shortDate(t.created_at)}
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
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function UsersPanel() {
  const qc = useQueryClient();
  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => (await supabase.from("profiles").select("*")).data ?? [],
  });
  const { data: roles } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => (await supabase.from("user_roles").select("*")).data ?? [],
  });

  const toggleAgent = async (userId: string, isAgent: boolean) => {
    const { error } = isAgent
      ? await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "agent")
      : await supabase.from("user_roles").insert({ user_id: userId, role: "agent" });
    if (error) {
      toast.error("No se pudo cambiar el rol");
      return;
    }
    toast.success("Rol actualizado");
    qc.invalidateQueries({ queryKey: ["admin-roles"] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Usuarios y agentes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {(profiles ?? []).map((p) => {
          const mine = (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role);
          const isAgent = mine.includes("agent");
          return (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
              <div>
                <p className="font-medium">{p.full_name || "Sin nombre"}</p>
                <p className="text-xs text-muted-foreground">{p.phone || "sin teléfono"}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {mine.map((r) => (
                  <Badge key={r} variant="outline">
                    {r}
                  </Badge>
                ))}
                <Badge className={KYC_TONE[p.kyc_status as KycStatus]} variant="secondary">
                  {KYC_LABEL[p.kyc_status as KycStatus]}
                </Badge>
              </div>
              <Button size="sm" variant="outline" onClick={() => void toggleAgent(p.id, isAgent)}>
                {isAgent ? "Quitar agente" : "Hacer agente"}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function RatesPanel() {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [from, setFrom] = useState("MXN");
  const [to, setTo] = useState("HTG");
  const { data: countries } = useCountries();

  const originCurrencies = Array.from(
    new Set((countries ?? []).filter((c) => c.is_origin).map((c) => c.currency)),
  ).sort();
  const destCurrencies = Array.from(
    new Set((countries ?? []).filter((c) => c.is_destination).map((c) => c.currency)),
  ).sort();

  const { data: rates } = useQuery({
    queryKey: ["all-rates"],
    queryFn: async () =>
      (
        await supabase
          .from("exchange_rates")
          .select("*")
          .eq("is_active", true)
          .order("from_currency")
      ).data ?? [],
  });

  const rate = (rates ?? []).find((r) => r.from_currency === from && r.to_currency === to);

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const values = {
      rate: Number(f.get("rate")),
      fee_percent: Number(f.get("fee_percent")),
      fee_fixed: Number(f.get("fee_fixed")),
      agent_commission_percent: Number(f.get("agent_commission_percent")),
    };
    if (Object.values(values).some((v) => !Number.isFinite(v) || v < 0)) {
      toast.error("Valores inválidos");
      return;
    }
    setSaving(true);
    const { error } = rate
      ? await supabase.from("exchange_rates").update(values).eq("id", rate.id)
      : await supabase
          .from("exchange_rates")
          .insert({ ...values, is_active: true, from_currency: from, to_currency: to });
    setSaving(false);
    if (error) {
      toast.error("No se pudo guardar");
      return;
    }
    toast.success("Tarifas actualizadas");
    qc.invalidateQueries({ queryKey: ["all-rates"] });
    qc.invalidateQueries({ queryKey: ["rate"] });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tarifas por corredor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Moneda de origen</Label>
              <Select value={from} onValueChange={setFrom}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {originCurrencies.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Moneda de destino</Label>
              <Select value={to} onValueChange={setTo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {destCurrencies.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2" key={`${from}-${to}`}>
            <Field name="rate" label={`${to} por 1 ${from}`} value={rate?.rate} step="0.0001" />
            <Field name="fee_percent" label="Comisión (%)" value={rate?.fee_percent} step="0.01" />
            <Field
              name="fee_fixed"
              label={`Comisión fija (${from})`}
              value={rate?.fee_fixed}
              step="0.01"
            />
            <Field
              name="agent_commission_percent"
              label="Comisión del agente (%)"
              value={rate?.agent_commission_percent}
              step="0.01"
            />
            <Button type="submit" disabled={saving} className="sm:col-span-2">
              {saving ? "Guardando…" : rate ? "Actualizar tarifas" : "Crear corredor"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Corredores activos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {(rates ?? []).map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setFrom(r.from_currency);
                setTo(r.to_currency);
              }}
              className="rounded-xl border p-3 text-left transition-colors hover:bg-secondary"
            >
              <p className="font-medium">
                {r.from_currency} → {r.to_currency}
              </p>
              <p className="text-xs text-muted-foreground">
                1 {r.from_currency} = {Number(r.rate).toFixed(4)} {r.to_currency} · comisión{" "}
                {Number(r.fee_percent)}% + {Number(r.fee_fixed)} {r.from_currency}
              </p>
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  name,
  label,
  value,
  step,
}: {
  name: string;
  label: string;
  value: number | undefined;
  step: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type="number" step={step} min="0" defaultValue={value ?? 0} />
    </div>
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
