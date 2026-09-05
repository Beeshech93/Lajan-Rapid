import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KYC_LABEL, KYC_TONE, shortDate, type KycStatus } from "@/lib/remesa";

type KycRow = {
  id: string;
  user_id: string;
  document_type: string;
  document_number: string;
  address: string;
  birth_date: string;
  status: string;
  review_notes: string | null;
  document_photo_path: string | null;
  document_back_path: string | null;
  created_at: string;
};

export function KycPanel() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-kyc"],
    queryFn: async () =>
      ((
        await supabase.from("kyc_submissions").select("*").order("created_at", { ascending: false })
      ).data ?? []) as KycRow[],
  });

  const [viewer, setViewer] = useState<{ front?: string; back?: string } | null>(null);
  const [rejectTarget, setRejectTarget] = useState<KycRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const viewDocuments = async (row: KycRow) => {
    const urls: { front?: string; back?: string } = {};
    if (row.document_photo_path) {
      const { data: signed } = await supabase.storage
        .from("kyc-documents")
        .createSignedUrl(row.document_photo_path, 300);
      if (signed?.signedUrl) urls.front = signed.signedUrl;
    }
    if (row.document_back_path) {
      const { data: signed } = await supabase.storage
        .from("kyc-documents")
        .createSignedUrl(row.document_back_path, 300);
      if (signed?.signedUrl) urls.back = signed.signedUrl;
    }
    if (!urls.front && !urls.back) {
      toast.error("Esta solicitud no tiene fotos adjuntas");
      return;
    }
    setViewer(urls);
  };

  const review = async (
    id: string,
    userId: string,
    status: "approved" | "rejected",
    notes: string | null,
  ) => {
    const { error } = await supabase
      .from("kyc_submissions")
      .update({ status, review_notes: notes })
      .eq("id", id);
    if (!error) await supabase.from("profiles").update({ kyc_status: status }).eq("id", userId);
    if (error) {
      toast.error("No se pudo actualizar");
      return;
    }
    toast.success(status === "approved" ? "KYC aprobado" : "KYC rechazado");
    qc.invalidateQueries({ queryKey: ["admin-kyc"] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Solicitudes de verificación</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {(data ?? []).length === 0 && (
          <p className="py-4 text-sm text-muted-foreground">Sin solicitudes.</p>
        )}
        {(data ?? []).map((k) => (
          <div
            key={k.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
          >
            <div>
              <p className="font-medium">
                {k.document_type.toUpperCase()} · {k.document_number}
              </p>
              <p className="text-xs text-muted-foreground">
                {k.address} · nac. {k.birth_date} · {shortDate(k.created_at)}
              </p>
              {k.review_notes && (
                <p className="mt-1 text-xs text-destructive">Motivo: {k.review_notes}</p>
              )}
            </div>
            <Badge className={KYC_TONE[k.status as KycStatus]} variant="secondary">
              {KYC_LABEL[k.status as KycStatus]}
            </Badge>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => void viewDocuments(k)}
              >
                <Eye className="size-4" /> Ver documento
              </Button>
              {k.status === "pending" && (
                <>
                  <Button size="sm" onClick={() => void review(k.id, k.user_id, "approved", null)}>
                    Aprobar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setRejectTarget(k);
                      setRejectReason("");
                    }}
                  >
                    Rechazar
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={!!viewer} onOpenChange={(open) => !open && setViewer(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Foto del documento</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {viewer?.front && (
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">Frente</p>
                <img src={viewer.front} alt="Frente del documento" className="rounded-lg border" />
              </div>
            )}
            {viewer?.back && (
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">Reverso</p>
                <img src={viewer.back} alt="Reverso del documento" className="rounded-lg border" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar verificación</DialogTitle>
            <DialogDescription>
              Explica el motivo; el usuario lo verá para poder corregirlo y volver a enviar.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Ej: la foto del frente está borrosa, no se lee el número de documento."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            maxLength={300}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim()}
              onClick={() => {
                if (!rejectTarget) return;
                void review(rejectTarget.id, rejectTarget.user_id, "rejected", rejectReason.trim());
                setRejectTarget(null);
              }}
            >
              Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
