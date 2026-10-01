import * as React from "react";
import { render } from "@react-email/render";
import { Webhook } from "standardwebhooks";
import { createFileRoute } from "@tanstack/react-router";
import { SignupEmail } from "@/lib/email-templates/signup";
import { InviteEmail } from "@/lib/email-templates/invite";
import { MagicLinkEmail } from "@/lib/email-templates/magic-link";
import { RecoveryEmail } from "@/lib/email-templates/recovery";
import { EmailChangeEmail } from "@/lib/email-templates/email-change";
import { ReauthenticationEmail } from "@/lib/email-templates/reauthentication";

// Reemplaza el handler de Lovable (@lovable.dev/email-js): este endpoint es el
// "Send Email" Auth Hook que Supabase llama directamente (configurado en
// Supabase Dashboard → Authentication → Hooks), firmado con SEND_EMAIL_HOOK_SECRET
// (formato Standard Webhooks: "v1,whsec_..."), y el envío real va por Resend
// usando las credenciales ya guardadas en el panel de administración.

const SITE_NAME = "Lajan Rapid";
const ROOT_DOMAIN = "lajanrapid.app";
const SITE_URL = `https://${ROOT_DOMAIN}`;

interface SupabaseUser {
  email: string;
  new_email?: string;
}

interface SupabaseEmailData {
  token: string;
  token_hash: string;
  token_new?: string;
  token_hash_new?: string;
  redirect_to: string;
  email_action_type:
    "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "reauthentication";
  site_url: string;
}

interface SupabaseAuthHookPayload {
  user: SupabaseUser;
  email_data: SupabaseEmailData;
}

function buildVerifyUrl(supabaseUrl: string, tokenHash: string, type: string, redirectTo: string) {
  const url = new URL("/auth/v1/verify", supabaseUrl);
  url.searchParams.set("token", tokenHash);
  url.searchParams.set("type", type);
  url.searchParams.set("redirect_to", redirectTo);
  return url.toString();
}

async function buildEmail(payload: SupabaseAuthHookPayload): Promise<{
  to: string;
  subject: string;
  html: string;
} | null> {
  const { user, email_data } = payload;
  const supabaseUrl = process.env["SUPABASE_URL"];
  if (!supabaseUrl) throw new Error("Falta SUPABASE_URL en el entorno del servidor");

  const confirmationUrl = buildVerifyUrl(
    supabaseUrl,
    email_data.token_hash,
    email_data.email_action_type,
    email_data.redirect_to || SITE_URL,
  );

  switch (email_data.email_action_type) {
    case "signup":
      return {
        to: user.email,
        subject: "Confirma tu correo",
        html: await render(
          React.createElement(SignupEmail, {
            siteName: SITE_NAME,
            siteUrl: SITE_URL,
            recipient: user.email,
            confirmationUrl,
          }),
        ),
      };
    case "invite":
      return {
        to: user.email,
        subject: "Has sido invitado",
        html: await render(
          React.createElement(InviteEmail, {
            siteName: SITE_NAME,
            siteUrl: SITE_URL,
            confirmationUrl,
          }),
        ),
      };
    case "magiclink":
      return {
        to: user.email,
        subject: "Tu enlace de acceso",
        html: await render(
          React.createElement(MagicLinkEmail, {
            siteName: SITE_NAME,
            confirmationUrl,
          }),
        ),
      };
    case "recovery":
      return {
        to: user.email,
        subject: "Restablece tu contraseña",
        html: await render(
          React.createElement(RecoveryEmail, {
            siteName: SITE_NAME,
            confirmationUrl,
          }),
        ),
      };
    case "email_change":
      return {
        to: user.email,
        subject: "Confirma tu nuevo correo",
        html: await render(
          React.createElement(EmailChangeEmail, {
            siteName: SITE_NAME,
            oldEmail: user.email,
            email: user.email,
            newEmail: user.new_email ?? "",
            confirmationUrl,
          }),
        ),
      };
    case "reauthentication":
      return {
        to: user.email,
        subject: "Tu código de verificación",
        html: await render(React.createElement(ReauthenticationEmail, { token: email_data.token })),
      };
    default:
      return null;
  }
}

export const Route = createFileRoute("/lovable/email/auth/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["SEND_EMAIL_HOOK_SECRET"];
        if (!secret) {
          console.error("SEND_EMAIL_HOOK_SECRET no está configurado");
          return Response.json({ error: "Server configuration error" }, { status: 500 });
        }

        const body = await request.text();
        const headers = Object.fromEntries(request.headers.entries());

        let payload: SupabaseAuthHookPayload;
        try {
          const wh = new Webhook(secret);
          payload = wh.verify(body, headers) as SupabaseAuthHookPayload;
        } catch (e) {
          console.error("Firma de Auth Hook inválida:", e);
          return Response.json({ error: "Invalid signature" }, { status: 401 });
        }

        try {
          const email = await buildEmail(payload);
          if (!email) {
            console.error(
              "Tipo de email_action_type desconocido:",
              payload.email_data.email_action_type,
            );
            return Response.json({ error: "Unknown email type" }, { status: 400 });
          }

          const { resendSendEmail } = await import("@/lib/resend.server");
          const result = await resendSendEmail(email);
          if (!result.ok) {
            console.error("Resend falló al enviar el correo de auth:", result.error);
            return Response.json({ error: result.error }, { status: 500 });
          }

          return Response.json({ ok: true });
        } catch (e) {
          console.error("Error procesando el Auth Hook de Supabase:", e);
          return Response.json(
            { error: e instanceof Error ? e.message : "Unknown error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
