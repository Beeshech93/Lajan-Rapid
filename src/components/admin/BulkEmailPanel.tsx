import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { resendSendAnnouncement } from "@/lib/resend.functions";

export function BulkEmailPanel() {
  const sendAnnouncement = useServerFn(resendSendAnnouncement);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const mutation = useMutation({
    mutationFn: () => sendAnnouncement({ data: { subject, message } }),
    onSuccess: (result) => {
      if (result.failed > 0) {
        toast.error(result.message);
      } else {
        toast.success(result.message);
        setSubject("");
        setMessage("");
        setConfirmed(false);
      }
    },
    onError: (error: Error) => toast.error(error.message || "No se pudo enviar el correo."),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-4" /> Enviar correo a todos los usuarios
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Envía un anuncio individual a cada cuenta con correo confirmado. Las direcciones de otros usuarios no se muestran.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="bulk-email-subject">Asunto</Label>
          <Input
            id="bulk-email-subject"
            value={subject}
            maxLength={150}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Ej. Novedades de Lajan Rapid"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bulk-email-message">Mensaje</Label>
          <Textarea
            id="bulk-email-message"
            value={message}
            maxLength={5000}
            rows={8}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Escribe aquí el mensaje para tus usuarios…"
          />
          <p className="text-xs text-muted-foreground">{message.length}/5000 caracteres</p>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          <span>Confirmo que quiero enviar este mensaje a todos los usuarios con correo confirmado.</span>
        </label>
        <Button
          className="w-full gap-2"
          disabled={mutation.isPending || !confirmed || subject.trim().length < 3 || message.trim().length < 2}
          onClick={() => mutation.mutate()}
        >
          <Send className="size-4" />
          {mutation.isPending ? "Enviando a los usuarios…" : "Enviar correo a todos"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Solo administradores pueden iniciar el envío. Revisa el asunto y el contenido antes de confirmar.
        </p>
      </CardContent>
    </Card>
  );
}
