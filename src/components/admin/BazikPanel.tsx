import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { PlugZap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { bazikSaveCredentials, bazikStatus, bazikTestAuth } from "@/lib/bazik.functions";

const CRED_KEYS = [
  "BAZIK_BASE_URL",
  "BAZIK_USER_ID",
  "BAZIK_SECRET_KEY",
  "BAZIK_WEBHOOK_SECRET",
  "BAZIK_ENVIRONMENT",
] as const;
type CredKey = (typeof CRED_KEYS)[number];

const EMPTY: Record<CredKey, string> = {
  BAZIK_BASE_URL: "",
  BAZIK_USER_ID: "",
  BAZIK_SECRET_KEY: "",
  BAZIK_WEBHOOK_SECRET: "",
  BAZIK_ENVIRONMENT: "",
};

export function BazikPanel() {
  const status = useServerFn(bazikStatus);
  const testAuth = useServerFn(bazikTestAuth);
  const saveCreds = useServerFn(bazikSaveCredentials);
  const queryClient = useQueryClient();

  const { data: info } = useQuery({ queryKey: ["bazik_status"], queryFn: () => status() });

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
      void queryClient.invalidateQueries({ queryKey: ["bazik_status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testMut = useMutation({
    mutationFn: () => testAuth(),
    onSuccess: (r) => {
      if (r.ok) toast.success("Autenticación con Bazik exitosa");
      else toast.error(r.error);
      void queryClient.invalidateQueries({ queryKey: ["bazik_status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PlugZap className="size-4" /> Conexión con Bazik
            <Badge variant={info?.configured ? "secondary" : "destructive"}>
              {info?.configured ? "Configurado" : "Sin configurar"}
            </Badge>
            {info?.configured ? (
              <Badge variant={info.authOk ? "default" : "destructive"}>
                {info.authOk ? "Autenticación OK" : "Error de autenticación"}
              </Badge>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {info?.baseUrl ? (
            <p className="text-xs text-muted-foreground">
              {info.baseUrl} · entorno: {info.environment}
            </p>
          ) : null}
          {info?.authError ? <p className="text-xs text-destructive">{info.authError}</p> : null}
          <p className="text-xs text-muted-foreground">
            MonCash únicamente · máx. 75,000 HTG por transacción · límite 100 req/min.
          </p>
          <p className="text-xs text-amber-600">
            El payout aún no está implementado: falta el spec de los endpoints de
            transferencia/cotización de Bazik.
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={testMut.isPending || !info?.configured}
            onClick={() => testMut.mutate()}
          >
            Probar autenticación
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Credenciales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="bazik-url">URL base de la API</Label>
            <Input
              id="bazik-url"
              placeholder={info?.baseUrl ?? "https://api.bazik.io"}
              value={creds.BAZIK_BASE_URL}
              onChange={(e) => setCred("BAZIK_BASE_URL", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bazik-userid">User ID</Label>
            <Input
              id="bazik-userid"
              type="password"
              placeholder="userID de Bazik"
              value={creds.BAZIK_USER_ID}
              onChange={(e) => setCred("BAZIK_USER_ID", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bazik-secret">Secret Key</Label>
            <Input
              id="bazik-secret"
              type="password"
              placeholder="secretKey de Bazik"
              value={creds.BAZIK_SECRET_KEY}
              onChange={(e) => setCred("BAZIK_SECRET_KEY", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bazik-webhook">Webhook secret (opcional)</Label>
            <Input
              id="bazik-webhook"
              type="password"
              placeholder="Secreto para verificar webhooks"
              value={creds.BAZIK_WEBHOOK_SECRET}
              onChange={(e) => setCred("BAZIK_WEBHOOK_SECRET", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bazik-env">Entorno</Label>
            <Select
              {...(creds.BAZIK_ENVIRONMENT ? { value: creds.BAZIK_ENVIRONMENT } : {})}
              onValueChange={(v) => setCred("BAZIK_ENVIRONMENT", v)}
            >
              <SelectTrigger id="bazik-env">
                <SelectValue placeholder={info?.environment ?? "production"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Sandbox</SelectItem>
                <SelectItem value="production">Producción</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            disabled={saveMut.isPending}
            onClick={() => saveMut.mutate()}
            className="w-full"
          >
            Guardar credenciales
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
