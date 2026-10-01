import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Image as ImageIcon, Megaphone, Save, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getBannerConfig, updateBannerConfig, type BannerType } from "@/lib/banner.functions";

export function AdBannerPanel() {
  const getConfig = useServerFn(getBannerConfig);
  const updateConfig = useServerFn(updateBannerConfig);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: config } = useQuery({
    queryKey: ["ad_banner_config"],
    queryFn: () => getConfig(),
  });

  const [form, setForm] = useState({
    enabled: false,
    type: "text" as BannerType,
    text: "",
    image_url: "",
    link_url: "",
  });

  useEffect(() => {
    if (config) setForm(config);
  }, [config]);

  const saveMut = useMutation({
    mutationFn: () => {
      if (form.enabled && form.type === "text" && !form.text.trim()) {
        throw new Error("Escribe el texto del banner o apágalo");
      }
      if (form.enabled && form.type === "image" && !form.image_url.trim()) {
        throw new Error("Sube una imagen o apaga el banner");
      }
      return updateConfig({ data: form });
    },
    onSuccess: () => {
      toast.success("Banner actualizado");
      void queryClient.invalidateQueries({ queryKey: ["ad_banner_config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleUpload = async (file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      toast.error("La imagen no puede pesar más de 4 MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("ad-banner")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("ad-banner").getPublicUrl(path);
      setForm((f) => ({ ...f, image_url: data.publicUrl }));
      toast.success("Imagen subida");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir la imagen");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            Banner de publicidad
          </CardTitle>
          <CardDescription>
            Se muestra en las páginas públicas y dentro de la app. Puede ser un texto con link o una
            imagen con link.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
            <div>
              <Label htmlFor="banner-enabled">Mostrar banner</Label>
              <p className="text-xs text-muted-foreground">Apágalo para ocultarlo al instante</p>
            </div>
            <Switch
              id="banner-enabled"
              checked={form.enabled}
              onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tipo de banner</Label>
            <Select
              value={form.type}
              onValueChange={(v) => setForm((f) => ({ ...f, type: v as BannerType }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Texto + link</SelectItem>
                <SelectItem value="image">Imagen + link</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.type === "text" ? (
            <div className="space-y-1.5">
              <Label htmlFor="banner-text">Texto del banner</Label>
              <Textarea
                id="banner-text"
                placeholder="Ej: Envía antes del viernes y gana comisión 0% 🎉"
                value={form.text}
                onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
                rows={3}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Imagen del banner</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleUpload(file);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                {uploading ? "Subiendo…" : "Subir imagen"}
              </Button>
              {form.image_url ? (
                <div className="overflow-hidden rounded-xl border">
                  <img src={form.image_url} alt="" className="h-auto w-full object-cover" />
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                  <ImageIcon className="h-4 w-4" /> Sin imagen todavía
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="banner-link">Link al hacer clic (opcional)</Label>
            <Input
              id="banner-link"
              placeholder="https://…"
              value={form.link_url}
              onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))}
            />
          </div>

          <Button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
            className="w-full gap-2"
          >
            <Save className="h-4 w-4" />
            {saveMut.isPending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vista previa</CardTitle>
          <CardDescription>Así se ve el banner activo ahora mismo</CardDescription>
        </CardHeader>
        <CardContent>
          {!config?.enabled ? (
            <p className="text-sm text-muted-foreground">
              El banner está apagado, no se muestra en ningún lado.
            </p>
          ) : config.type === "image" && config.image_url ? (
            <div className="overflow-hidden rounded-2xl border bg-secondary/40">
              <img src={config.image_url} alt="" className="h-auto w-full object-cover" />
            </div>
          ) : config.type === "text" && config.text ? (
            <div className="rounded-2xl border bg-secondary/40 px-4 py-3">
              <p className="text-center text-sm font-medium">{config.text}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              El banner está activado pero le falta contenido, no se mostrará.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
