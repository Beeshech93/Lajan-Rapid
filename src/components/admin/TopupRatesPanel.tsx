import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type TopupRateRow = {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  is_active: boolean;
};

export function TopupRatesPanel() {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [from, setFrom] = useState("MXN");
  const [to, setTo] = useState("USD");

  const { data: rates } = useQuery({
    queryKey: ["all-topup-rates"],
    queryFn: async () =>
      ((await supabase.from("topup_rates").select("*").order("from_currency")).data ??
        []) as TopupRateRow[],
  });

  const rate = (rates ?? []).find(
    (r) => r.from_currency === from.toUpperCase() && r.to_currency === to.toUpperCase(),
  );

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const value = Number(f.get("rate"));
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Tasa inválida");
      return;
    }
    setSaving(true);
    const { error } = rate
      ? await supabase.from("topup_rates").update({ rate: value }).eq("id", rate.id)
      : await supabase.from("topup_rates").insert({
          rate: value,
          is_active: true,
          from_currency: from.toUpperCase(),
          to_currency: to.toUpperCase(),
        });
    setSaving(false);
    if (error) {
      toast.error("No se pudo guardar");
      return;
    }
    toast.success("Tasa de recarga actualizada");
    qc.invalidateQueries({ queryKey: ["all-topup-rates"] });
    qc.invalidateQueries({ queryKey: ["topup_rate"] });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tasas de recarga (DingConnect)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Tasa manual específica para recargas móviles — de la moneda que paga el usuario a la
            moneda real que pide el operador (ej. MXN a USD para Digicel Haití). Separada de las
            tasas de envíos de dinero, para poder ajustarlas sin afectarse entre sí.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="topup-from">Moneda de pago</Label>
              <Input
                id="topup-from"
                value={from}
                onChange={(e) => setFrom(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="MXN"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="topup-to">Moneda del operador</Label>
              <Input
                id="topup-to"
                value={to}
                onChange={(e) => setTo(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="USD"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="topup-rate">
                Tasa (1 {from || "?"} = ? {to || "?"})
              </Label>
              <Input
                id="topup-rate"
                name="rate"
                type="number"
                step="0.0001"
                min="0"
                defaultValue={rate?.rate ?? ""}
                key={rate?.id ?? `${from}-${to}`}
                placeholder="0.0500"
              />
              {rate && <p className="text-xs text-muted-foreground">Ya configurada: {rate.rate}</p>}
            </div>
            <Button type="submit" disabled={saving} className="sm:col-span-2">
              {saving ? "Guardando..." : "Guardar tasa"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tasas configuradas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(rates ?? []).length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">Sin tasas configuradas todavía.</p>
          )}
          {(rates ?? []).map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-lg border p-3 text-sm"
            >
              <button
                type="button"
                className="text-left hover:underline"
                onClick={() => {
                  setFrom(r.from_currency);
                  setTo(r.to_currency);
                }}
              >
                1 {r.from_currency} = {r.rate} {r.to_currency}
              </button>
              <Badge variant={r.is_active ? "default" : "secondary"}>
                {r.is_active ? "Activa" : "Inactiva"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
