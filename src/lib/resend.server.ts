// Conector Resend — envío del correo de bienvenida real (posterior a la
// confirmación de la cuenta), distinto del correo de confirmación que ya
// envía Supabase Auth. Credenciales guardadas desde el panel de admin.

export const RESEND_CRED_NAMES = [
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "WELCOME_EMAIL_WEBHOOK_SECRET",
  "ADMIN_ALERT_EMAIL",
] as const;

export type ResendCredName = (typeof RESEND_CRED_NAMES)[number];

const RESEND_API = "https://api.resend.com";

export async function loadResendCreds(client?: any): Promise<Record<string, string>> {
  try {
    const sb = client ?? (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const { data } = await sb
      .from("integration_credentials")
      .select("name, value")
      .in("name", [...RESEND_CRED_NAMES]);
    const out: Record<string, string> = {};
    for (const row of data ?? []) if (row.value) out[row.name] = row.value;
    return out;
  } catch (e) {
    console.error("No se pudieron leer las credenciales de Resend", e);
    return {};
  }
}

export async function saveResendCred(name: string, value: string, userId: string, client?: any) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const primary = client ?? supabaseAdmin;

  if (!value) {
    let delError: any;
    try {
      const res = await primary.from("integration_credentials").delete().eq("name", name);
      delError = res.error;
    } catch (e: any) {
      delError = e;
    }
    if (delError && primary !== supabaseAdmin) {
      try {
        const res = await supabaseAdmin.from("integration_credentials").delete().eq("name", name);
        delError = res.error;
      } catch (e: any) {
        delError = e;
      }
    }
    if (delError) throw new Error(`Error borrando credencial ${name}: ${delError.message || delError}`);
    return;
  }

  const now = new Date().toISOString();
  let upsertError: any;
  try {
    const res = await primary
      .from("integration_credentials")
      .upsert(
        { name, value, updated_at: now, updated_by: userId },
        { onConflict: "name" },
      );
    upsertError = res.error;
  } catch (e: any) {
    upsertError = e;
  }

  if (upsertError && primary !== supabaseAdmin) {
    try {
      const res = await supabaseAdmin
        .from("integration_credentials")
        .upsert(
          { name, value, updated_at: now, updated_by: userId },
          { onConflict: "name" },
        );
      upsertError = res.error;
    } catch (e: any) {
      upsertError = e;
    }
  }

  if (upsertError) throw new Error(`Error guardando credencial ${name}: ${upsertError.message || upsertError}`);
}

function pick(stored: Record<string, string>, name: ResendCredName) {
  return process.env[name] ?? stored[name];
}

export async function resendStatusInfo(client?: any) {
  const stored = await loadResendCreds(client);
  return {
    hasApiKey: Boolean(pick(stored, "RESEND_API_KEY")),
    hasFromEmail: Boolean(pick(stored, "RESEND_FROM_EMAIL")),
    hasWebhookSecret: Boolean(pick(stored, "WELCOME_EMAIL_WEBHOOK_SECRET")),
    fromEmail: pick(stored, "RESEND_FROM_EMAIL") ?? null,
    alertEmail: pick(stored, "ADMIN_ALERT_EMAIL") ?? null,
  };
}

/** Verifica que el secreto compartido enviado por el trigger de la base de datos sea válido. */
export async function verifyWelcomeWebhookSecret(provided: string | null): Promise<boolean> {
  if (!provided) return false;
  const stored = await loadResendCreds();
  const expected = pick(stored, "WELCOME_EMAIL_WEBHOOK_SECRET");
  if (!expected) return false;
  return provided === expected;
}

export type ResendSendResult = { ok: true; id?: string } | { ok: false; error: string };

/** Envía un correo real vía la API de Resend. */
export async function resendSendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<ResendSendResult> {
  const stored = await loadResendCreds();
  const apiKey = pick(stored, "RESEND_API_KEY");
  const from = pick(stored, "RESEND_FROM_EMAIL");

  if (!apiKey || !from) {
    return {
      ok: false,
      error:
        "Falta la conexión de Resend: necesita API Key y correo remitente en el panel de administración.",
    };
  }

  try {
    const response = await fetch(`${RESEND_API}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
      }),
    });

    const text = await response.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      // respuesta no-JSON
    }

    if (!response.ok) {
      const message = (parsed["message"] as string | undefined) ?? text.slice(0, 200);
      console.error(`Resend /emails falló [${response.status}]: ${text}`);
      return { ok: false, error: `Resend rechazó el envío: ${message}` };
    }

    const id = parsed["id"] as string | undefined;
    return id ? { ok: true, id } : { ok: true };
  } catch (error) {
    console.error("Resend /emails lanzó error:", error);
    return { ok: false, error: "No se pudo contactar a Resend para enviar el correo." };
  }
}


export type ResendBulkEmail = { to: string; subject: string; html: string };
export type ResendBulkResult = { sent: number; failed: number };

/**
 * Envía correos individuales en lotes de hasta 100. Cada mensaje tiene un solo
 * destinatario, por lo que las direcciones no se comparten entre usuarios.
 */
export async function resendSendBulkEmails(
  emails: ResendBulkEmail[],
): Promise<ResendBulkResult> {
  if (emails.length === 0) return { sent: 0, failed: 0 };

  const stored = await loadResendCreds();
  const apiKey = pick(stored, "RESEND_API_KEY");
  const from = pick(stored, "RESEND_FROM_EMAIL");
  if (!apiKey || !from) {
    throw new Error(
      "Falta la conexión de Resend: configura la API Key y el correo remitente en Administración → Correo.",
    );
  }

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < emails.length; i += 100) {
    const batch = emails.slice(i, i + 100);
    try {
      const response = await fetch(`${RESEND_API}/emails/batch`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          batch.map((email) => ({
            from,
            to: [email.to],
            subject: email.subject,
            html: email.html,
          })),
        ),
      });
      const text = await response.text();
      let parsed: { data?: unknown[]; message?: string } = {};
      try {
        parsed = JSON.parse(text) as typeof parsed;
      } catch {
        // Respuesta no-JSON: se registra abajo sin exponer credenciales.
      }

      if (!response.ok) {
        console.error(`Resend /emails/batch falló [${response.status}]: ${text.slice(0, 500)}`);
        failed += batch.length;
        continue;
      }

      const accepted = Array.isArray(parsed.data) ? parsed.data.length : 0;
      sent += Math.min(accepted, batch.length);
      failed += batch.length - Math.min(accepted, batch.length);
    } catch (error) {
      console.error("Resend batch lanzó un error:", error);
      failed += batch.length;
    }
  }
  return { sent, failed };
}
