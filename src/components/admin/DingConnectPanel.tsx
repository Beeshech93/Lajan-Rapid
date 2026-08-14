import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Save, Smartphone, Webhook } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { dingSaveCredentials, dingStatus } from "@/lib/dingconnect.functions";

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

const CRED_KEYS = ["DINGCONNECT_BASE_URL", "DINGCONNECT_API_KEY", "DINGCONNECT_WEBHOOK_SECRET"] as const;
type CredKey = (typeof CRED_KEYS)[number];

const EMPTY: Record<CredKey, string> = {
  DINGCONNECT_BASE_URL: "",
  DINGCONNECT_API_KEY: "",
  DINGCONNECT_WEBHOOK_SECRET: "",
};

export function DingConnectPanel() {
  const status = useServerFn(dingStatus);
  const saveCreds = useServerFn(dingSaveCredentials);
  const queryClient = useQueryClient();

  const { data: info } = useQuery({ queryKey: ["dingconnect_status"], queryFn: () => status() });

  const [creds, setCreds] = useState<Record<CredKey, string>>(EMPTY);
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
      setCreds(EMPTY);
      void queryClient.invalidateQueries({ queryKey: ["dingconnect_status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const webhookUrl = `${origin}/api/public/dingconnect/webhook`;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="size-4" /> Webhook de DingConnect
            <Badge variant={info?.hasWebhookSecret ? "default" : "secondary"}>
              {info?.hasWebhookSecret ? "Verificación activa" : "Sin secreto"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Pega esta URL en DingConnect → Webhooks / Notificaciones de transferencia. Las recargas se enlazan por{" "}
            <code>DistributorRef</code> (referencia <code>LR-TU-XXXXXXXX</code>).
          </p>
          <CopyField label="URL de notificaciones" value={webhookUrl} />
          <p className="text-xs text-muted-foreground">
            Enviar el secreto en la cabecera <code>x-webhook-secret</code>, o firmar el cuerpo con HMAC-SHA256 en{" "}
            <code>x-signature</code>.
          </p>
          <ul className="list-disc pl-5 text-sm text-muted-foreground">
            <li>
              Completed → recarga <strong>completada</strong>.
            </li>
            <li>
              Processing / Pending → <strong>en proceso</strong>.
            </li>
            <li>
              Failed o cancelada → <strong>fallida</strong> y se devuelve el saldo.
            </li>
            <li>El cliente recibe una notificación con cada cambio.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="size-4" /> Credenciales de recargas
            <Badge variant={info?.hasApiKey ? "default" : "secondary"}>
              {info?.hasApiKey ? "API Key cargada" : "Falta API Key"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ding-url">URL base de la API</Label>
            <Input
              id="ding-url"
              placeholder={info?.baseUrl ?? "https://api.dingconnect.com/api/V1"}
              value={creds.DINGCONNECT_BASE_URL}
              onChange={(e) => setCred("DINGCONNECT_BASE_URL", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ding-key">API Key</Label>
            <Input
              id="ding-key"
              type="password"
              placeholder="api_key de DingConnect"
              value={creds.DINGCONNECT_API_KEY}
              onChange={(e) => setCred("DINGCONNECT_API_KEY", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ding-secret">Secreto del webhook</Label>
            <Input
              id="ding-secret"
              type="password"
              placeholder="Secreto compartido para verificar notificaciones"
              value={creds.DINGCONNECT_WEBHOOK_SECRET}
              onChange={(e) => setCred("DINGCONNECT_WEBHOOK_SECRET", e.target.value)}
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
