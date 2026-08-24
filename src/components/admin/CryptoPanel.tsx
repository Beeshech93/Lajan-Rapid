import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Coins, Check, X, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { money, shortDate } from "@/lib/remesa";
import {
  useCryptoAssets,
  useCryptoDeposits,
  useCryptoWithdrawals,
  useRefreshCrypto,
  type CryptoAsset,
} from "@/hooks/useCrypto";
import { payCryptoWithdrawal } from "@/lib/crypto.functions";

function AssetRow({ asset, onSaved }: { asset: CryptoAsset; onSaved: () => void }) {
  const [form, setForm] = useState({
    deposit_address: asset.deposit_address,
    htg_rate: String(asset.htg_rate),
    min_deposit: String(asset.min_deposit),
    fee_percent: String(asset.fee_percent),
    is_active: asset.is_active,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("crypto_assets")
      .update({
        deposit_address: form.deposit_address.trim(),
        htg_rate: Number(form.htg_rate) || 0,
        min_deposit: Number(form.min_deposit) || 0,
        fee_percent: Number(form.fee_percent) || 0,
        is_active: form.is_active,
      })
      .eq("id", asset.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${asset.code} actualizado`);
    onSaved();
  };

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">
            {asset.code} <span className="text-muted-foreground">· {asset.network}</span>
          </p>
          <p className="text-xs text-muted-foreground">{asset.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={`active-${asset.id}`} className="text-xs">
            Activo
          </Label>
          <Switch
            id={`active-${asset.id}`}
            checked={form.is_active}
            onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Dirección de depósito</Label>
          <Input
            value={form.deposit_address}
            onChange={(e) => setForm((f) => ({ ...f, deposit_address: e.target.value }))}
            className="font-mono text-xs"
            placeholder="Dirección de la red"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Tasa a HTG (1 {asset.code} = ? HTG)</Label>
          <Input
            inputMode="decimal"
            value={form.htg_rate}
            onChange={(e) => setForm((f) => ({ ...f, htg_rate: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Depósito mínimo ({asset.code})</Label>
          <Input
            inputMode="decimal"
            value={form.min_deposit}
            onChange={(e) => setForm((f) => ({ ...f, min_deposit: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Comisión (%)</Label>
          <Input
            inputMode="decimal"
            value={form.fee_percent}
            onChange={(e) => setForm((f) => ({ ...f, fee_percent: e.target.value }))}
          />
        </div>
      </div>
      <Button size="sm" onClick={() => void save()} disabled={saving}>
        {saving ? "Guardando…" : "Guardar"}
      </Button>
    </div>
  );
}

function DepositsPanel() {
  const { data: deposits } = useCryptoDeposits();
  const { data: assets } = useCryptoAssets(true);
  const refresh = useRefreshCrypto();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const review = async (id: string, approve: boolean) => {
    setBusy(id);
    const { error } = await supabase.rpc("approve_crypto_deposit", {
      _deposit_id: id,
      _approve: approve,
      ...(notes[id] ? { _notes: notes[id] as string } : {}),
    });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(approve ? "Depósito acreditado" : "Depósito rechazado");
    refresh();
  };

  const assetLabel = (id: string) => {
    const a = (assets ?? []).find((x) => x.id === id);
    return a ? `${a.code} (${a.network})` : "—";
  };

  return (
    <div className="space-y-3">
      {(deposits ?? []).length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">Sin depósitos.</p>
      )}
      {(deposits ?? []).map((d) => (
        <div key={d.id} className="space-y-2 rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold">
                {Number(d.amount_crypto)} {assetLabel(d.asset_id)}
              </p>
              <p className="text-xs text-muted-foreground">
                {d.reference} · {shortDate(d.created_at)}
              </p>
            </div>
            <Badge variant="secondary">{d.status}</Badge>
          </div>
          <p className="break-all font-mono text-xs text-muted-foreground">Hash: {d.tx_hash}</p>
          {d.status === "pending" ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[200px] flex-1 space-y-1.5">
                <Label>Notas</Label>
                <Input
                  value={notes[d.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [d.id]: e.target.value }))}
                  placeholder="Opcional"
                />
              </div>
              <Button size="sm" disabled={busy === d.id} onClick={() => void review(d.id, true)}>
                <Check className="size-4" /> Acreditar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={busy === d.id}
                onClick={() => void review(d.id, false)}
              >
                <X className="size-4" /> Rechazar
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {money(Number(d.amount_htg), "HTG")} · {d.review_notes ?? "sin notas"}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function WithdrawalsPanel() {
  const { data: withdrawals } = useCryptoWithdrawals();
  const refresh = useRefreshCrypto();
  const pay = useServerFn(payCryptoWithdrawal);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const payMutation = useMutation({
    mutationFn: (withdrawalId: string) => pay({ data: { withdrawalId } }),
    onSuccess: (res) => {
      if (res.ok) toast.success("Pago enviado vía Bazik");
      else toast.error(res.error ?? "Bazik rechazó el pago");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const settle = async (id: string, status: string) => {
    const { error } = await supabase.rpc("settle_crypto_withdrawal", {
      _id: id,
      _status: status,
      ...(notes[id] ? { _notes: notes[id] as string } : {}),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(status === "completed" ? "Marcado como pagado" : "Retiro rechazado");
    refresh();
  };

  return (
    <div className="space-y-3">
      {(withdrawals ?? []).length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">Sin retiros.</p>
      )}
      {(withdrawals ?? []).map((w) => (
        <div key={w.id} className="space-y-2 rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold">
                {money(Number(w.amount_htg), "HTG")} · {w.kind}
              </p>
              <p className="break-all text-xs text-muted-foreground">
                {w.reference} · {w.destination} · {shortDate(w.created_at)}
              </p>
            </div>
            <Badge variant="secondary">{w.status}</Badge>
          </div>
          {(w.status === "pending" || w.status === "processing") && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[200px] flex-1 space-y-1.5">
                <Label>Notas</Label>
                <Input
                  value={notes[w.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [w.id]: e.target.value }))}
                  placeholder="Opcional"
                />
              </div>
              {(w.kind === "moncash" || w.kind === "natcash") && (
                <Button
                  size="sm"
                  disabled={payMutation.isPending}
                  onClick={() => payMutation.mutate(w.id)}
                >
                  <Send className="size-4" /> Pagar con Bazik
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => void settle(w.id, "completed")}>
                Marcar pagado
              </Button>
              <Button size="sm" variant="destructive" onClick={() => void settle(w.id, "rejected")}>
                Rechazar
              </Button>
            </div>
          )}
          {w.review_notes && <p className="text-xs text-muted-foreground">{w.review_notes}</p>}
        </div>
      ))}
    </div>
  );
}

export function CryptoPanel() {
  const { data: assets } = useCryptoAssets(true);
  const refresh = useRefreshCrypto();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Coins className="size-4" /> Cripto — tasas, depósitos y retiros
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="activos">
          <TabsList>
            <TabsTrigger value="activos">Activos y tasas</TabsTrigger>
            <TabsTrigger value="depositos">Depósitos</TabsTrigger>
            <TabsTrigger value="retiros">Retiros</TabsTrigger>
          </TabsList>
          <TabsContent value="activos" className="mt-4 space-y-3">
            {(assets ?? []).map((a) => (
              <AssetRow key={a.id} asset={a} onSaved={refresh} />
            ))}
          </TabsContent>
          <TabsContent value="depositos" className="mt-4">
            <DepositsPanel />
          </TabsContent>
          <TabsContent value="retiros" className="mt-4">
            <WithdrawalsPanel />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
