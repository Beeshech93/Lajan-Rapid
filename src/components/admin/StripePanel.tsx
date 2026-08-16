import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Copy, CreditCard, Save, Webhook } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { stripeSaveCredentials, stripeStatus } from "@/lib/stripe.functions";

function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs" />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Copiar ${label}`}
          onClick={() => {
            void navigator.clipboard.writeText(value);
            toast.success("Copiado");
          }}
        >
          <Copy className="size-4" />
        </Button>
      </div>
    </div>
  );
}

const CRED_KEYS = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] as const;
type CredKey = (typeof CRED_KEYS)[number];

export function StripePanel() {
  const status = useServerFn(stripeStatus);
  const saveCreds = useServerFn(stripeSaveCredentials);
  const queryClient = useQueryClient();

  const { data: info } = useQuery({
    queryKey: ["stripe_status"],
    queryFn: () => status(),
  });

  const [creds, setCreds] = useState<Record<CredKey, string>>({
    STRIPE_SECRET_KEY: "",
    STRIPE_WEBHOOK_SECRET: "",
  });
  const setCred = (k: CredKey, v: string) => setCreds((p) => ({ ...p, [k]: v }));

  const saveMut = useMutation({
    mutationFn: () => {
      const payload: Partial<Record<CredKey, string>> = {};
      for (const k of CRED_KEYS) if (creds[k].trim()) payload[k] = creds[k].trim();
      if (Object.keys(payload).length === 0) throw new Error("Nada para guardar");
      return saveCreds({ data: payload });
    },
    onSuccess: () => {
      toast.success("Credenciales guardadas");
      setCreds({ STRIPE_SECRET_KEY: "", STRIPE_WEBHOOK_SECRET: "" });
      void queryClient.invalidateQueries({ queryKey: ["stripe_status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const webhookUrl = `${origin}/api/public/stripe/webhook`;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="size-4" /> Webhook de Stripe
            <Badge variant={info?.hasWebhookSecret ? "default" : "secondary"}>
              {info?.hasWebhookSecret ? "Firma activa" : "Sin clave secreta"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Pega esta URL en Stripe → Developers → Webhooks → Add endpoint. El envío se enlaza
            por <code>client_reference_id</code> o <code>metadata.reference</code>, que debe ser la
            referencia del envío (ej. <code>RH-XXXXXXXX</code>).
          </p>
          <CopyField label="URL del endpoint (producción y pruebas)" value={webhookUrl} />
          <div className="space-y-1 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Eventos a seleccionar:</p>
            <p className="font-mono text-xs">
              checkout.session.completed, checkout.session.expired,
              checkout.session.async_payment_succeeded, checkout.session.async_payment_failed,
              payment_intent.succeeded, payment_intent.processing,
              payment_intent.payment_failed, payment_intent.canceled, charge.refunded
            </p>
          </div>
          <ul className="list-disc pl-5 text-sm text-muted-foreground">
            <li>Pago exitoso → el envío pasa a <strong>Pagado</strong>.</li>
            <li>Pago en proceso → <strong>Esperando pago</strong>.</li>
            <li>Fallido, cancelado o devuelto → <strong>Cancelado</strong>.</li>
            <li>El cliente recibe una notificación en la app con cada cambio.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="size-4" /> Credenciales
            <Badge variant={info?.hasSecretKey ? "default" : "secondary"}>
              {info?.hasSecretKey ? `Clave cargada (${info.mode})` : "Falta clave secreta"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="stripe-key">Secret key</Label>
            <Input
              id="stripe-key"
              type="password"
              placeholder="sk_live_... o sk_test_..."
              value={creds.STRIPE_SECRET_KEY}
              onChange={(e) => setCred("STRIPE_SECRET_KEY", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stripe-secret">Signing secret del webhook</Label>
            <Input
              id="stripe-secret"
              type="password"
              placeholder="whsec_..."
              value={creds.STRIPE_WEBHOOK_SECRET}
              onChange={(e) => setCred("STRIPE_WEBHOOK_SECRET", e.target.value)}
            />
          </div>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="w-full">
            <Save className="mr-2 size-4" />
            {saveMut.isPending ? "Guardando..." : "Guardar credenciales"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Los valores se guardan cifrados en el backend y nunca se muestran de vuelta.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
