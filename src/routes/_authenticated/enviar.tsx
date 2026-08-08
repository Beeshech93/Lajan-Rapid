import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useCountries, useRate } from "@/hooks/useCorridors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  quote,
  money,
  paymentMethods,
  deliveryMethods,
  citiesFor,
  ZERO_RATE,
} from "@/lib/remesa";

export const Route = createFileRoute("/_authenticated/enviar")({
  head: () => ({
    meta: [
      { title: "Enviar dinero — Lajan Rapid" },
      {
        name: "description",
        content:
          "Envía dinero desde América o Europa hacia Haití y República Dominicana con comisión transparente.",
      },
      { property: "og:title", content: "Enviar dinero — Lajan Rapid" },
      {
        property: "og:description",
        content: "Calcula, elige método de pago y envía a Haití o República Dominicana.",
      },
    ],
  }),
  component: Enviar,
});

const schema = z.object({
  recipient_name: z.string().trim().min(3, "Nombre del destinatario requerido").max(100),
  recipient_phone: z.string().trim().min(6, "Teléfono requerido").max(25),
  recipient_city: z.string().trim().min(2, "Ciudad requerida").max(60),
  amount: z.number().positive("Ingresa un monto válido").max(5_000_000, "Monto demasiado alto"),
  note: z.string().trim().max(300).optional(),
});

function Enviar() {
  const router = useRouter();
  const { user, profile } = useProfile();
  const { data: countries } = useCountries();

  const [origin, setOrigin] = useState("MX");
  const [destination, setDestination] = useState("HT");
  const [amount, setAmount] = useState("2000");
  const [payment, setPayment] = useState("oxxo");
  const [delivery, setDelivery] = useState("moncash");
  const [city, setCity] = useState("Port-au-Prince");
  const [saving, setSaving] = useState(false);

  const origins = (countries ?? []).filter((c) => c.is_origin);
  const destinations = (countries ?? []).filter((c) => c.is_destination);
  const originCountry = origins.find((c) => c.code === origin);
  const destCountry = destinations.find((c) => c.code === destination);

  const { data: cfg } = useRate(originCountry?.currency, destCountry?.currency);

  const payments = useMemo(() => paymentMethods(origin), [origin]);
  const deliveries = useMemo(() => deliveryMethods(destination), [destination]);
  const cities = useMemo(() => citiesFor(destination), [destination]);

  const sendCur = originCountry?.currency ?? "";
  const recvCur = destCountry?.currency ?? "";
  const q = quote(Number(amount), cfg ?? ZERO_RATE);

  const changeOrigin = (code: string) => {
    setOrigin(code);
    setPayment(paymentMethods(code)[0]?.value ?? "bank_transfer");
  };

  const changeDestination = (code: string) => {
    setDestination(code);
    setDelivery(deliveryMethods(code)[0]?.value ?? "moncash");
    setCity(citiesFor(code)[0] ?? "");
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!cfg || !user) return;
    const form = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      recipient_name: String(form.get("recipient_name") ?? ""),
      recipient_phone: String(form.get("recipient_phone") ?? ""),
      recipient_city: city,
      amount: Number(amount),
      note: String(form.get("note") ?? ""),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Revisa los datos");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("transfers")
      .insert({
        user_id: user.id,
        origin_country: origin,
        destination_country: destination,
        recipient_name: parsed.data.recipient_name,
        recipient_phone: parsed.data.recipient_phone,
        recipient_city: parsed.data.recipient_city,
        delivery_method: delivery,
        payment_method: payment,
        amount_send: parsed.data.amount,
        rate: cfg.rate,
        note: parsed.data.note || null,
        status: "awaiting_payment",
      })
      .select("id")
      .single();
    setSaving(false);
    if (error) {
      toast.error("No pudimos crear el envío");
      return;
    }
    toast.success("Envío creado. Completa el pago.");
    router.navigate({ to: "/transferencia/$id", params: { id: data.id } });
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold">Enviar dinero</h1>

      {profile?.kyc_status !== "approved" && (
        <p className="rounded-xl bg-warning/10 p-3 text-sm text-warning-foreground">
          Puedes crear el envío, pero se procesará cuando tu identidad esté verificada.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Corredor y monto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Envías desde</Label>
              <Select value={origin} onValueChange={changeOrigin}>
                <SelectTrigger>
                  <SelectValue placeholder="País de origen" />
                </SelectTrigger>
                <SelectContent>
                  {origins.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.flag} {c.name} · {c.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Recibe en</Label>
              <Select value={destination} onValueChange={changeDestination}>
                <SelectTrigger>
                  <SelectValue placeholder="País de destino" />
                </SelectTrigger>
                <SelectContent>
                  {destinations.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.flag} {c.name} · {c.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="monto">Tú envías ({sendCur || "—"})</Label>
            <Input
              id="monto"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              className="h-12 text-lg font-semibold"
            />
          </div>

          {!cfg && sendCur && recvCur && (
            <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              Este corredor aún no tiene tipo de cambio activo. Elige otro país o vuelve más tarde.
            </p>
          )}

          <div className="space-y-1.5 rounded-xl bg-secondary p-4 text-sm">
            <Line
              label="Tipo de cambio"
              value={cfg ? `1 ${sendCur} = ${Number(cfg.rate).toFixed(4)} ${recvCur}` : "—"}
            />
            <Line label="Comisión" value={money(q.fee, sendCur)} />
            <Line label="Total a pagar" value={money(q.total, sendCur)} strong />
          </div>
          <div className="rounded-xl bg-mint p-4">
            <p className="text-xs font-semibold text-accent-foreground/80">Tu familia recibe</p>
            <p className="font-display text-2xl font-bold text-accent-foreground">
              {money(q.receives, recvCur)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            2. Destinatario en {destCountry?.name ?? "destino"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="recipient_name">Nombre completo</Label>
            <Input id="recipient_name" name="recipient_name" required maxLength={100} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recipient_phone">Teléfono</Label>
            <Input id="recipient_phone" name="recipient_phone" type="tel" required maxLength={25} />
          </div>
          <div className="space-y-1.5">
            <Label>Ciudad</Label>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona ciudad" />
              </SelectTrigger>
              <SelectContent>
                {cities.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Forma de entrega</Label>
            <Select value={delivery} onValueChange={setDelivery}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {deliveries.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label} — {d.hint}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="note">Mensaje (opcional)</Label>
            <Textarea id="note" name="note" maxLength={300} rows={2} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">3. Método de pago</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {payments.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setPayment(m.value)}
              className={`rounded-xl border p-4 text-left transition-colors ${
                payment === m.value ? "border-accent bg-accent/10" : "hover:bg-secondary"
              }`}
            >
              <p className="font-medium">{m.label}</p>
              <p className="text-xs text-muted-foreground">{m.hint}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      <Button type="submit" size="lg" className="w-full" disabled={saving || !cfg}>
        {saving ? "Creando envío…" : `Confirmar envío de ${money(q.total, sendCur)}`}
      </Button>
    </form>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-semibold" : "font-medium"}>{value}</span>
    </div>
  );
}
