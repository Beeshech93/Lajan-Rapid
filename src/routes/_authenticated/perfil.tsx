import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
import { KYC_TONE, type KycStatus } from "@/lib/remesa";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Mi perfil y verificación — Lajan Rapid" },
      { name: "description", content: "Actualiza tus datos y verifica tu identidad (KYC)." },
      { property: "og:title", content: "Mi perfil y verificación — Lajan Rapid" },
      { property: "og:description", content: "Datos personales y estado de verificación KYC." },
    ],
  }),
  component: Perfil,
});

function Perfil() {
  const { user, profile, roles, reload } = useProfile();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingKyc, setSavingKyc] = useState(false);
  const [docType, setDocType] = useState("ine");
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);

  const profileSchema = useMemo(
    () =>
      z.object({
        full_name: z.string().trim().min(3, t("profile.err_name")).max(100),
        phone: z.string().trim().min(6, t("profile.err_phone")).max(25),
      }),
    [t],
  );

  const kycSchema = useMemo(
    () =>
      z.object({
        document_type: z.string().min(2),
        document_number: z.string().trim().min(4, t("profile.err_doc_number")).max(40),
        birth_date: z.string().min(4, t("profile.err_birth_date")),
        address: z.string().trim().min(6, t("profile.err_address")).max(200),
      }),
    [t],
  );

  const KYC_LABEL: Record<KycStatus, string> = {
    none: t("profile.kyc_none"),
    pending: t("profile.kyc_pending"),
    approved: t("profile.kyc_approved"),
    rejected: t("profile.kyc_rejected"),
  };

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
      toast.error(t("profile.err_save"));
      return;
    }
    toast.success(t("profile.success_save"));
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
    if (!frontFile) {
      toast.error(t("profile.err_no_front"));
      return;
    }
    if (frontFile.size > 8 * 1024 * 1024 || (backFile && backFile.size > 8 * 1024 * 1024)) {
      toast.error(t("profile.err_file_size"));
      return;
    }

    setSavingKyc(true);
    try {
      const stamp = Date.now();
      const frontPath = `${user!.id}/${stamp}-frente.${frontFile.name.split(".").pop() ?? "jpg"}`;
      const { error: uploadFrontError } = await supabase.storage
        .from("kyc-documents")
        .upload(frontPath, frontFile);
      if (uploadFrontError) throw uploadFrontError;

      let backPath: string | null = null;
      if (backFile) {
        backPath = `${user!.id}/${stamp}-reverso.${backFile.name.split(".").pop() ?? "jpg"}`;
        const { error: uploadBackError } = await supabase.storage
          .from("kyc-documents")
          .upload(backPath, backFile);
        if (uploadBackError) throw uploadBackError;
      }

      const { error } = await supabase.from("kyc_submissions").insert({
        user_id: user!.id,
        ...parsed.data,
        status: "pending",
        document_photo_path: frontPath,
        document_back_path: backPath,
      });
      if (error) throw error;

      await supabase.from("profiles").update({ kyc_status: "pending" }).eq("id", user!.id);
      toast.success(t("profile.success_kyc"));
      setFrontFile(null);
      setBackFile(null);
      qc.invalidateQueries({ queryKey: ["kyc", user?.id] });
      void reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("profile.err_kyc_send"));
    } finally {
      setSavingKyc(false);
    }
  };

  const kyc = (profile?.kyc_status ?? "none") as KycStatus;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold">{t("profile.title")}</h1>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t("profile.personal_data")}</CardTitle>
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
              <Label htmlFor="full_name">{t("profile.full_name")}</Label>
              <Input
                id="full_name"
                name="full_name"
                defaultValue={profile?.full_name ?? ""}
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">{t("profile.phone")}</Label>
              <Input id="phone" name="phone" defaultValue={profile?.phone ?? ""} maxLength={25} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("profile.email")}</Label>
              <Input value={user?.email ?? ""} disabled />
            </div>
            <Button type="submit" disabled={savingProfile} className="sm:col-span-2">
              {savingProfile ? t("profile.saving") : t("profile.save_changes")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t("profile.kyc_title")}</CardTitle>
          <Badge className={KYC_TONE[kyc]} variant="secondary">
            {KYC_LABEL[kyc]}
          </Badge>
        </CardHeader>
        <CardContent>
          {kyc === "approved" ? (
            <p className="text-sm text-muted-foreground">{t("profile.kyc_approved_desc")}</p>
          ) : kyc === "pending" ? (
            <p className="text-sm text-muted-foreground">{t("profile.kyc_pending_desc")}</p>
          ) : (
            <form onSubmit={saveKyc} className="grid gap-4 sm:grid-cols-2">
              {submission?.review_notes && (
                <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive sm:col-span-2">
                  {submission.review_notes}
                </p>
              )}
              <div className="space-y-1.5">
                <Label>{t("profile.doc_type")}</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ine">{t("profile.doc_ine")}</SelectItem>
                    <SelectItem value="passport">{t("profile.doc_passport")}</SelectItem>
                    <SelectItem value="residency">{t("profile.doc_residency")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="document_number">{t("profile.doc_number")}</Label>
                <Input id="document_number" name="document_number" maxLength={40} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="birth_date">{t("profile.birth_date")}</Label>
                <Input id="birth_date" name="birth_date" type="date" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address">{t("profile.address")}</Label>
                <Input id="address" name="address" maxLength={200} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doc-front">{t("profile.doc_front")}</Label>
                <Input
                  id="doc-front"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => setFrontFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doc-back">{t("profile.doc_back")}</Label>
                <Input
                  id="doc-back"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => setBackFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <Button type="submit" disabled={savingKyc} className="sm:col-span-2">
                {savingKyc ? t("profile.sending") : t("profile.send_verification")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
