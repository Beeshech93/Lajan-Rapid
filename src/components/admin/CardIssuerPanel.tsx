import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CreditCard, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  cardIssuerSaveCredentials,
  cardIssuerStatus,
  cardSaveProgramConfig,
} from "@/lib/cards.functions";


type Status = Awaited<ReturnType<typeof cardIssuerStatus>>;

export function CardIssuerPanel() {
  const loadStatus = useServerFn(cardIssuerStatus);
  const saveCreds = useServerFn(cardIssuerSaveCredentials);
  const saveProgram = useServerFn(cardSaveProgramConfig);

  const [status, setStatus] = useState<Status | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [busy, setBusy] = useState(false);

  const [provider, setProvider] = useState<"mock" | "visa" | "mastercard">("mock");
  const [visaEnabled, setVisaEnabled] = useState(false);
  const [mcEnabled, setMcEnabled] = useState(false);
  const [visaBaseUrl, setVisaBaseUrl] = useState("");
  const [visaKey, setVisaKey] = useState("");
  const [visaUserId, setVisaUserId] = useState("");
  const [mcBaseUrl, setMcBaseUrl] = useState("");
  const [mcKey, setMcKey] = useState("");
  const [mcClientId, setMcClientId] = useState("");
  const [mcClientSecret, setMcClientSecret] = useState("");

  const refresh = async () => {
    try {
      const s = await loadStatus({});
      setStatus(s);
      setBaseUrl(s.baseUrl);
      setProvider(s.program.provider);
      setVisaEnabled(s.program.visaEnabled);
      setMcEnabled(s.program.mastercardEnabled);
    } catch {
      /* sin permisos */
    }
  };

  const saveProgramConfig = async () => {
    setBusy(true);
    try {
      const p = await saveProgram({
        data: {
          CARD_PROVIDER: provider,
          VISA_ENABLED: visaEnabled ? "true" : "false",
          MASTERCARD_ENABLED: mcEnabled ? "true" : "false",
          ...(visaBaseUrl ? { VISA_BASE_URL: visaBaseUrl } : {}),
          ...(visaKey ? { VISA_API_KEY: visaKey } : {}),
          ...(visaUserId ? { VISA_USER_ID: visaUserId } : {}),
          ...(mcBaseUrl ? { MASTERCARD_BASE_URL: mcBaseUrl } : {}),
          ...(mcKey ? { MASTERCARD_API_KEY: mcKey } : {}),
          ...(mcClientId ? { MASTERCARD_CLIENT_ID: mcClientId } : {}),
          ...(mcClientSecret ? { MASTERCARD_CLIENT_SECRET: mcClientSecret } : {}),
        },
      });
      setStatus((prev) => (prev ? { ...prev, program: p } : prev));
      setVisaKey("");
      setVisaUserId("");
      setMcKey("");
      setMcClientId("");
      setMcClientSecret("");
      toast.success("Programa de tarjetas actualizado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  };


  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      await saveCreds({
        data: {
          CARD_API_BASE_URL: baseUrl,
          ...(apiKey ? { CARD_API_KEY: apiKey } : {}),
          ...(apiSecret ? { CARD_API_SECRET: apiSecret } : {}),
        },
      });
      toast.success("Credenciales del emisor guardadas");
      setApiKey("");
      setApiSecret("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="size-4" /> Programa de tarjetas
            <Badge variant={status?.program.live ? "secondary" : "outline"}>
              {status?.program.live ? "Producción" : "Sandbox"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Elige el proveedor emisor. Puedes cambiar de Visa a Mastercard sin tocar el código: la
            app usa la misma interfaz para ambos.
          </p>

          <div className="space-y-1.5">
            <Label>Proveedor activo</Label>
            <Select
              value={provider}
              onValueChange={(v) => setProvider(v as "mock" | "visa" | "mastercard")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mock">Sandbox (pruebas)</SelectItem>
                <SelectItem value="visa">Visa</SelectItem>
                <SelectItem value="mastercard">Mastercard</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Visa habilitada</p>
                <p className="text-xs text-muted-foreground">
                  {status?.program.hasVisaCredentials ? "Credenciales guardadas" : "Sin credenciales"}
                </p>
              </div>
              <Switch checked={visaEnabled} onCheckedChange={setVisaEnabled} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Mastercard habilitada</p>
                <p className="text-xs text-muted-foreground">
                  {status?.program.hasMastercardCredentials
                    ? "Credenciales guardadas"
                    : "Sin credenciales"}
                </p>
              </div>
              <Switch checked={mcEnabled} onCheckedChange={setMcEnabled} />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <p className="text-sm font-medium">Credenciales Visa</p>
            <Input
              value={visaBaseUrl}
              onChange={(e) => setVisaBaseUrl(e.target.value)}
              placeholder="VISA_BASE_URL — https://sandbox.api.visa.com"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                type="password"
                value={visaKey}
                onChange={(e) => setVisaKey(e.target.value)}
                placeholder="VISA_API_KEY"
              />
              <Input
                value={visaUserId}
                onChange={(e) => setVisaUserId(e.target.value)}
                placeholder="VISA_USER_ID"
              />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <p className="text-sm font-medium">Credenciales Mastercard</p>
            <Input
              value={mcBaseUrl}
              onChange={(e) => setMcBaseUrl(e.target.value)}
              placeholder="MASTERCARD_BASE_URL — https://sandbox.api.mastercard.com"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                type="password"
                value={mcKey}
                onChange={(e) => setMcKey(e.target.value)}
                placeholder="MASTERCARD_API_KEY"
              />
              <Input
                value={mcClientId}
                onChange={(e) => setMcClientId(e.target.value)}
                placeholder="MASTERCARD_CLIENT_ID"
              />
            </div>
            <Input
              type="password"
              value={mcClientSecret}
              onChange={(e) => setMcClientSecret(e.target.value)}
              placeholder="MASTERCARD_CLIENT_SECRET"
            />
          </div>

          <Button disabled={busy} onClick={saveProgramConfig}>
            Guardar programa
          </Button>

          {status?.program.requiresApproval && (
            <p className="text-xs text-muted-foreground">
              Recuerda: la emisión real requiere aprobación del BIN sponsor y del programa de la red.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="size-4" /> API de tarjetas virtuales
            <Badge variant={status?.configured ? "secondary" : "outline"}>
              {status?.configured ? "Conectada" : "Sin conectar"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Conecta al emisor de tarjetas para que los clientes vean todos los datos de su tarjeta
            (número completo, vencimiento y CVV). Los datos sensibles nunca se guardan: se piden al
            emisor en el momento.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="card-base-url">URL base del emisor</Label>
            <Input
              id="card-base-url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.tu-emisor.com"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="card-key">
                API Key {status?.hasKey && <span className="text-success">· guardada</span>}
              </Label>
              <Input
                id="card-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  status?.hasKey ? "•••••••• (dejar vacío para conservar)" : "CARD_API_KEY"
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="card-secret">
                API Secret {status?.hasSecret && <span className="text-success">· guardada</span>}
              </Label>
              <Input
                id="card-secret"
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder={
                  status?.hasSecret ? "•••••••• (dejar vacío para conservar)" : "CARD_API_SECRET"
                }
              />
            </div>
          </div>

          <Button disabled={busy} onClick={save}>
            Guardar credenciales
          </Button>

          <div className="rounded-lg border p-3 text-xs text-muted-foreground">
            <p className="flex items-center gap-2 font-medium text-foreground">
              <ShieldCheck className="size-3.5" /> Endpoint que se consulta
            </p>
            <p className="mt-1 break-all font-mono">
              GET {status?.detailsEndpoint ?? "…/v1/cards/{provider_card_id}/secure-details"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

