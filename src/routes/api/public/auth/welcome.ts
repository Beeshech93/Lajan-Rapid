import { createFileRoute } from "@tanstack/react-router";
import { render } from "@react-email/render";

/**
 * Llamado por un trigger de la base de datos (pg_net) cuando un usuario
 * confirma su correo por primera vez (auth.users.email_confirmed_at pasa de
 * NULL a un valor). Envía el correo de bienvenida real vía Resend, separado
 * del correo de confirmación que ya envía Supabase Auth.
 */
export const Route = createFileRoute("/api/public/auth/welcome")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyWelcomeWebhookSecret, resendSendEmail } = await import("@/lib/resend.server");

        const secret = request.headers.get("x-webhook-secret");
        const validSecret = await verifyWelcomeWebhookSecret(secret);
        if (!validSecret) {
          const { logAndAlertSecurityEvent } = await import("@/lib/security.server");
          await logAndAlertSecurityEvent({
            eventType: "webhook_invalid_signature",
            detail: { webhook: "welcome-email" },
          });
          return new Response("Invalid signature", { status: 401 });
        }

        let body: { email?: string; full_name?: string } = {};
        try {
          body = (await request.json()) as { email?: string; full_name?: string };
        } catch {
          return Response.json({ received: true, ignored: "payload inválido" });
        }

        const email = body.email?.trim();
        if (!email) {
          return Response.json({ received: true, ignored: "sin correo" });
        }

        const { AccountReadyEmail } = await import("@/lib/email-templates/account-ready");
        const base = process.env["PUBLIC_URL"] || "https://lajanrapid-app.lovable.app";
        const html = await render(
          AccountReadyEmail({
            siteName: "Lajan Rapid",
            siteUrl: base,
            ...(body.full_name ? { fullName: body.full_name } : {}),
          }),
        );

        const result = await resendSendEmail({
          to: email,
          subject: "¡Tu cuenta de Lajan Rapid ya está lista! 🚀",
          html,
        });

        if (!result.ok) console.warn("Correo de bienvenida:", result.error);

        return Response.json({ received: true, sent: result.ok });
      },
      GET: () => Response.json({ endpoint: "welcome-email", status: "ready" }),
    },
  },
});
