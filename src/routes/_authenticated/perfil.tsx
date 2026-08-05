import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
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
import { KYC_LABEL, KYC_TONE, type KycStatus } from "@/lib/remesa";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Mi perfil y verificación — RemesaHaití" },
      { name: "description", content: "Actualiza tus datos y verifica tu identidad (KYC)." },
      { property: "og:title", content: "Mi perfil y verificación — RemesaHaití" },
      { property: "og:description", content: "Datos personales y estado de verificación KYC." },
    ],
  }),
  component: Perfil,
});

const profileSchema = z.object({
  full_name: z.string().trim().min(3, "Nombre requerido").max(100),
  phone: z.string().trim().min(6, "Teléfono requerido").max(25),
});

const kycSchema = z.object({
  document_type: z.string().min(2),
  document_number: z.string().trim().min(4, "Número de documento requerido").max(40),
  birth_date: z.string().min(4, "Fecha de nacimiento requerida"),
  address: z.string().trim().min(6, "Dirección requerida").max(200),
});

function Perfil() {
  const { user, profile, roles, reload } = useProfile();
  const qc = useQueryClient();
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingKyc, setSavingKyc] = useState(false);
  const [docType, setDocType] = useState("ine");

  const { data: submission } = useQuery({
    queryKey: ["kyc", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("kyc_submissions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const saveProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = profileSchema.safeParse({
      full_name: String(form.get("full_name") ?? ""),
      phone: String(form.get("phone") ?? ""),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]!.message);
      return;
    }
    setSavingProfile(true);
    const { error } = await supabase.from("profiles").update(parsed.data).eq("id", user!.id);
    setSavingProfile(false);
    if (error) {
      toast.error("No se pudo guardar");
      return;
    }
    toast.success("Perfil actualizado");
    void reload();
  };

  const saveKyc = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = kycSchema.safeParse({
      document_type: docType,
      document_number: String(form.get("document_number") ?? ""),
      birth_date: String(form.get("birth_date") ?? ""),
      address: String(form.get("address") ?? ""),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]!.message);
      return;
    }
    setSavingKyc(true);
    const { error } = await supabase.from("kyc_submissions").insert({
      user_id: user!.id,
      ...parsed.data,
      status: "pending",
    });
    if (!error) await supabase.from("profiles").update({ kyc_status: "pending" }).eq("id", user!.id);
    setSavingKyc(false);
    if (error) {
      toast.error("No se pudo enviar la verificación");
      return;
    }
    toast.success("Verificación enviada. Te avisaremos al aprobarla.");
    qc.invalidateQueries({ queryKey: ["kyc", user?.id] });
    void reload();
  };

  const kyc = (profile?.kyc_status ?? "none") as KycStatus;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold">Mi perfil</h1>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Datos personales</CardTitle>
          <div className="flex gap-1">
            {roles.map((r) => (
              <Badge key={r} variant="outline">
                {r}
              </Badge>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Nombre completo</Label>
              <Input id="full_name" name="full_name" defaultValue={profile?.full_name ?? ""} maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Teléfono</Label>
              <Input id="phone" name="phone" defaultValue={profile?.phone ?? ""} maxLength={25} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Correo</Label>
              <Input value={user?.email ?? ""} disabled />
            </div>
            <Button type="submit" disabled={savingProfile} className="sm:col-span-2">
              {savingProfile ? "Guardando…" : "Guardar cambios"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Verificación de identidad (KYC)</CardTitle>
          <Badge className={KYC_TONE[kyc]} variant="secondary">
            {KYC_LABEL[kyc]}
          </Badge>
        </CardHeader>
        <CardContent>
          {kyc === "approved" ? (
            <p className="text-sm text-muted-foreground">
              Tu identidad está verificada. Puedes enviar sin límites adicionales.
            </p>
          ) : kyc === "pending" ? (
            <p className="text-sm text-muted-foreground">
              Tu documentación está en revisión. Normalmente tarda menos de 24 horas.
            </p>
          ) : (
            <form onSubmit={saveKyc} className="grid gap-4 sm:grid-cols-2">
              {submission?.review_notes && (
                <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive sm:col-span-2">
                  {submission.review_notes}
                </p>
              )}
              <div className="space-y-1.5">
                <Label>Tipo de documento</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ine">INE / IFE</SelectItem>
                    <SelectItem value="passport">Pasaporte</SelectItem>
                    <SelectItem value="residency">Tarjeta de residencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="document_number">Número de documento</Label>
                <Input id="document_number" name="document_number" maxLength={40} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="birth_date">Fecha de nacimiento</Label>
                <Input id="birth_date" name="birth_date" type="date" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address">Dirección</Label>
                <Input id="address" name="address" maxLength={200} />
              </div>
              <Button type="submit" disabled={savingKyc} className="sm:col-span-2">
                {savingKyc ? "Enviando…" : "Enviar verificación"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
