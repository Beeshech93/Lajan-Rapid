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
import { mercadoPagoSaveCredentials, mercadoPagoStatus } from "@/lib/mercadopago.functions";

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

const CRED_KEYS = ["MERCADOPAGO_ACCESS_TOKEN", "MERCADOPAGO_WEBHOOK_SECRET"] as const;
type CredKey = (typeof CRED_KEYS)[number];

export function MercadoPagoPanel() {
  const status = useServerFn(mercadoPagoStatus);
  const saveCreds = useServerFn(mercadoPagoSaveCredentials);
  const queryClient = useQueryClient();

  const { data: info } = useQuery({
    queryKey: ["mercadopago_status"],
    queryFn: () => status(),
  });

  const [creds, setCreds] = useState<Record<CredKey, string>>({
    MERCADOPAGO_ACCESS_TOKEN: "",
    MERCADOPAGO_WEBHOOK_SECRET: "",
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
      setCreds({ MERCADOPAGO_ACCESS_TOKEN: "", MERCADOPAGO_WEBHOOK_SECRET: "" });
      void queryClient.invalidateQueries({ queryKey: ["mercadopago_status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const webhookUrl = `${origin}/api/public/mercadopago/webhook`;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="size-4" /> Webhook de Mercado Pago
            <Badge variant={info?.hasWebhookSecret ? "default" : "secondary"}>
              {info?.hasWebhookSecret ? "Firma activa" : "Sin clave secreta"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Pega esta URL en Mercado Pago → Tus integraciones → Webhooks, y activa el evento
            <strong> Pagos</strong>. Los envíos se enlazan por <code>external_reference</code>, que
            debe ser la referencia del envío (ej. <code>RH-XXXXXXXX</code>).
          </p>
          <CopyField label="URL de notificaciones (producción y pruebas)" value={webhookUrl} />
          <ul className="list-disc pl-5 text-sm text-muted-foreground">
            <li>
              Pago aprobado → el envío pasa a <strong>Pagado</strong>.
            </li>
            <li>
              Pago pendiente o en proceso → <strong>Esperando pago</strong>.
            </li>
            <li>
              Rechazado, cancelado o devuelto → <strong>Cancelado</strong>.
            </li>
            <li>El cliente recibe una notificación en la app con cada cambio.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="size-4" /> Credenciales
            <Badge variant={info?.hasAccessToken ? "default" : "secondary"}>
              {info?.hasAccessToken ? "Token cargado" : "Falta token"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="mp-token">Access Token (Producción)</Label>
            <Input
              id="mp-token"
              type="password"
              placeholder="APP_USR-..."
              value={creds.MERCADOPAGO_ACCESS_TOKEN}
              onChange={(e) => setCred("MERCADOPAGO_ACCESS_TOKEN", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mp-secret">Clave secreta del webhook</Label>
            <Input
              id="mp-secret"
              type="password"
              placeholder="Se genera al crear el webhook en Mercado Pago"
              value={creds.MERCADOPAGO_WEBHOOK_SECRET}
              onChange={(e) => setCred("MERCADOPAGO_WEBHOOK_SECRET", e.target.value)}
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
