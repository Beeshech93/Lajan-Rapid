import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Mail, Save, Clock, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  getSupportConfig,
  updateSupportConfig,
} from "@/lib/support.functions";

const TIMEZONES = [
  "UTC",
  "America/Mexico_City",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/Madrid",
  "America/Bogota",
  "America/Lima",
];

export function SupportPanel() {
  const getConfig = useServerFn(getSupportConfig);
  const updateConfig = useServerFn(updateSupportConfig);
  const queryClient = useQueryClient();

  const { data: config } = useQuery({
    queryKey: ["support_config"],
    queryFn: () => getConfig(),
  });

  const [formData, setFormData] = useState({
    whatsapp_number: "",
    email: "",
    support_hours: "24/7",
    timezone: "UTC",
  });

  // Update form when config loads
  useEffect(() => {
    if (config) {
      setFormData({
        whatsapp_number: config.whatsapp_number || "",
        email: config.email || "",
        support_hours: config.support_hours || "24/7",
        timezone: config.timezone || "UTC",
      });
    }
  }, [config]);

  const updateMut = useMutation({
    mutationFn: () => {
      if (!formData.whatsapp_number.trim() && !formData.email.trim()) {
        throw new Error("Ingresa al menos un número de WhatsApp o email");
      }
      return updateConfig({ data: formData });
    },
    onSuccess: () => {
      toast.success("Configuración de soporte actualizada");
      void queryClient.invalidateQueries({ queryKey: ["support_config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const whatsappUrl = formData.whatsapp_number
    ? `https://wa.me/${formData.whatsapp_number.replace(/\D/g, "")}`
    : "";

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            WhatsApp
          </CardTitle>
          <CardDescription>Número de contacto de soporte</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="whatsapp">Número de WhatsApp</Label>
            <Input
              id="whatsapp"
              placeholder="+1234567890"
              value={formData.whatsapp_number}
              onChange={(e) => handleInputChange("whatsapp_number", e.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Incluye el código de país (ej: +55 para Brasil, +52 para México)
            </p>
          </div>

          {whatsappUrl && (
            <div className="rounded-lg bg-green-50 p-3 dark:bg-green-950">
              <p className="text-sm text-green-900 dark:text-green-50">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline hover:no-underline"
                >
                  Probar en WhatsApp →
                </a>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email
          </CardTitle>
          <CardDescription>Email de contacto de soporte</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="soporte@ejemplo.com"
              value={formData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Email donde recibirán mensajes de soporte
            </p>
          </div>

          {formData.email && (
            <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950">
              <p className="text-sm text-blue-900 dark:text-blue-50">
                <a
                  href={`mailto:${formData.email}`}
                  className="font-semibold underline hover:no-underline"
                >
                  Enviar email de prueba →
                </a>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Horas de Soporte
          </CardTitle>
          <CardDescription>Horarios y zona horaria</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="hours">Horarios</Label>
              <Input
                id="hours"
                placeholder="24/7 o Lun-Vie 9AM-6PM"
                value={formData.support_hours}
                onChange={(e) => handleInputChange("support_hours", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Zona Horaria</Label>
              <select
                id="timezone"
                value={formData.timezone}
                onChange={(e) => handleInputChange("timezone", e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Estado</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-50">
              ✓ Activo
            </Badge>
            <p className="text-sm text-muted-foreground">
              La información de soporte está disponible para todos los usuarios
            </p>
          </div>
          <Button
            onClick={() => updateMut.mutate()}
            disabled={updateMut.isPending}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {updateMut.isPending ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
