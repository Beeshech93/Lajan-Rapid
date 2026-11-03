import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  Send,
  Smartphone,
  Coins,
  AlertTriangle,
  CheckCircle2,
  Save,
  Power,
  Info,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  updateServicesConfig,
  type ServiceKey,
  type ServicesConfig,
} from "@/lib/services-config.functions";
import { useServicesConfig, SERVICES_CONFIG_QUERY_KEY } from "@/hooks/useServicesConfig";

type ServiceMeta = {
  key: ServiceKey;
  title: string;
  description: string;
  impact: string;
  icon: typeof Send;
  defaultMsg: string;
};

const SERVICES_META: ServiceMeta[] = [
  {
    key: "transfers",
    title: "Envío de Dinero (Remesas)",
    description: "Envíos directos a Haití y República Dominicana (MonCash, Natcash, etc.).",
    impact: "Si se desactiva, los clientes no podrán crear nuevas transferencias desde /enviar.",
    icon: Send,
    defaultMsg: "El servicio de transferencias está temporalmente en mantenimiento.",
  },
  {
    key: "topups",
    title: "Recargas Telefónicas",
    description: "Recargas móviles automáticas vía DingConnect (Digicel, Natcom, etc.).",
    impact: "Si se desactiva, los clientes no podrán enviar recargas desde /recargas.",
    icon: Smartphone,
    defaultMsg: "El servicio de recargas está en mantenimiento temporal.",
  },
  {
    key: "crypto",
    title: "Criptomonedas (USDT y conversiones)",
    description: "Depósitos y retiros en criptomonedas convertidos a gourdes.",
    impact: "Si se desactiva, los clientes no podrán solicitar depósitos ni retiros desde /cripto.",
    icon: Coins,
    defaultMsg: "El servicio cripto está temporalmente no disponible.",
  },
];

export function ServicesPanel() {
  const { data: initialConfig, isLoading } = useServicesConfig();
  const updateFn = useServerFn(updateServicesConfig);
  const queryClient = useQueryClient();

  const [state, setState] = useState<ServicesConfig>({
    transfers: { enabled: true, message: "" },
    topups: { enabled: true, message: "" },
    crypto: { enabled: true, message: "" },
  });

  useEffect(() => {
    if (initialConfig) {
      setState(initialConfig);
    }
  }, [initialConfig]);

  const toggleService = (key: ServiceKey, enabled: boolean) => {
    setState((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        enabled,
      },
    }));
  };

  const updateMessage = (key: ServiceKey, message: string) => {
    setState((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        message,
      },
    }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      return await updateFn({ data: state });
    },
    onSuccess: () => {
      toast.success("Estado de servicios guardado correctamente");
      void queryClient.invalidateQueries({ queryKey: SERVICES_CONFIG_QUERY_KEY });
    },
    onError: (err: any) => {
      toast.error(err?.message || "No se pudo guardar la configuración");
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Power className="size-5 text-accent" /> Control de Servicios para Clientes
              </CardTitle>
              <CardDescription className="mt-1 text-sm">
                Activa o desactiva de forma inmediata el acceso a los servicios clave de la plataforma.
                Cuando un servicio está inactivo, los clientes verán un aviso de mantenimiento y no podrán
                ejecutar la operación.
              </CardDescription>
            </div>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || isLoading}
              className="gap-2"
            >
              <Save className="size-4" />
              {saveMutation.isPending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-5 md:grid-cols-1 lg:grid-cols-3">
        {SERVICES_META.map((meta) => {
          const item = state[meta.key];
          const isEnabled = item?.enabled ?? true;
          const Icon = meta.icon;

          return (
            <Card
              key={meta.key}
              className={`flex flex-col justify-between border-2 transition-colors ${
                isEnabled ? "border-border" : "border-destructive/40 bg-destructive/5"
              }`}
            >
              <CardHeader className="space-y-3 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`grid size-10 place-items-center rounded-xl ${
                        isEnabled
                          ? "bg-accent/15 text-accent"
                          : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      <Icon className="size-5" />
                    </span>
                    <div>
                      <h3 className="font-semibold text-base leading-tight">{meta.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border bg-card p-3">
                  <div className="flex items-center gap-2">
                    {isEnabled ? (
                      <CheckCircle2 className="size-4 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="size-4 text-destructive" />
                    )}
                    <span className="text-sm font-medium">
                      {isEnabled ? "Servicio Activo" : "Deshabilitado"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={isEnabled ? "default" : "destructive"}>
                      {isEnabled ? "Activo" : "Inactivo"}
                    </Badge>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(val) => toggleService(meta.key, val)}
                      aria-label={`Activar o desactivar ${meta.title}`}
                    />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-0">
                <div className="space-y-1.5">
                  <Label htmlFor={`msg-${meta.key}`} className="text-xs font-medium">
                    Mensaje de mantenimiento al cliente (opcional)
                  </Label>
                  <Input
                    id={`msg-${meta.key}`}
                    value={item?.message ?? ""}
                    onChange={(e) => updateMessage(meta.key, e.target.value)}
                    placeholder={meta.defaultMsg}
                    className="text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Si se deja en blanco, se mostrará el mensaje predeterminado.
                  </p>
                </div>

                <div className="rounded-lg bg-muted/60 p-2.5 text-xs text-muted-foreground flex gap-2">
                  <Info className="size-4 shrink-0 text-muted-foreground/80 mt-0.5" />
                  <span>{meta.impact}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

