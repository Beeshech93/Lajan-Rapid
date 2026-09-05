// Registro y alerta de eventos de seguridad (firmas de webhook inválidas,
// intentos de escalar privilegios, etc.). Usado tanto por los webhooks
// públicos (llamada directa) como por triggers de la base de datos (vía el
// endpoint /api/public/security/alert).

export type SecurityEventType =
  | "webhook_invalid_signature"
  | "webhook_not_configured"
  | "kyc_self_approve_attempt"
  | "unauthorized_action";

/** Registra el evento y, si hay correo de alerta configurado, avisa de inmediato. */
export async function logAndAlertSecurityEvent(opts: {
  eventType: SecurityEventType;
  severity?: "info" | "warning" | "critical";
  detail: Record<string, unknown>;
  userId?: string | null;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("security_events").insert({
      event_type: opts.eventType,
      severity: opts.severity ?? "warning",
      detail: opts.detail as never,
      user_id: opts.userId ?? null,
    });
  } catch (e) {
    console.error("No se pudo registrar el evento de seguridad", e);
  }

  try {
    const { resendSendEmail, loadResendCreds } = await import("@/lib/resend.server");
    const stored = await loadResendCreds();
    const alertEmail = process.env["ADMIN_ALERT_EMAIL"] ?? stored["ADMIN_ALERT_EMAIL"];
    if (!alertEmail) return;

    await resendSendEmail({
      to: alertEmail,
      subject: `⚠️ Alerta de seguridad: ${opts.eventType}`,
      html: `
        <h2>Se detectó actividad sospechosa en Lajan Rapid</h2>
        <p><strong>Tipo:</strong> ${opts.eventType}</p>
        <p><strong>Severidad:</strong> ${opts.severity ?? "warning"}</p>
        <p><strong>Usuario:</strong> ${opts.userId ?? "no autenticado"}</p>
        <pre>${JSON.stringify(opts.detail, null, 2)}</pre>
      `,
    });
  } catch (e) {
    console.error("No se pudo enviar la alerta de seguridad por correo", e);
  }
}
