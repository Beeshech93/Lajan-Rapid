import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseResendCredentialsInput, type ResendCredentialsInput } from "@/lib/resend.schemas";

/** Estado de configuración de Resend (solo administradores). */
export const resendStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("No autorizado");
    const { resendStatusInfo } = await import("@/lib/resend.server");
    return resendStatusInfo();
  });

/** Guarda manualmente las credenciales de Resend (solo administradores). */
export const resendSaveCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ResendCredentialsInput) => parseResendCredentialsInput(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("No autorizado");
    const { saveResendCred } = await import("@/lib/resend.server");
    for (const [name, value] of Object.entries(data)) {
      if (value === undefined) continue;
      await saveResendCred(name, value.trim(), context.userId);
    }
    return { ok: true };
  });

/** Genera un secreto aleatorio para el webhook de bienvenida (solo administradores). */
export const resendGenerateWebhookSecret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("No autorizado");
    const { saveResendCred } = await import("@/lib/resend.server");
    const secret = crypto.randomUUID().replace(/-/g, "");
    await saveResendCred("WELCOME_EMAIL_WEBHOOK_SECRET", secret, context.userId);
    return { ok: true, secret };
  });

/** Envía un correo de prueba al propio administrador (solo administradores). */
export const resendSendTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("No autorizado");

    const email = context.claims?.email as string | undefined;
    if (!email) throw new Error("Tu cuenta de administrador no tiene correo");

    const { resendSendEmail } = await import("@/lib/resend.server");
    const { render } = await import("@react-email/render");
    const { AccountReadyEmail } = await import("@/lib/email-templates/account-ready");
    const base = process.env["PUBLIC_URL"] || "https://lajanrapid-app.lovable.app";
    const html = await render(
      AccountReadyEmail({ siteName: "Lajan Rapid", siteUrl: base, fullName: "Prueba" }),
    );
    return resendSendEmail({ to: email, subject: "Prueba: correo de bienvenida", html });
  });
