import { createFileRoute } from "@tanstack/react-router";

/**
 * Llamado por triggers de la base de datos (pg_net) cuando detectan un
 * intento de acción no autorizada (ej. auto-aprobar el propio KYC). Reutiliza
 * el secreto del webhook de correo de bienvenida para no duplicar credenciales
 * internas.
 */
export const Route = createFileRoute("/api/public/security/alert")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyWelcomeWebhookSecret } = await import("@/lib/resend.server");
        const secret = request.headers.get("x-webhook-secret");
        const validSecret = await verifyWelcomeWebhookSecret(secret);
        if (!validSecret) {
          return new Response("Invalid signature", { status: 401 });
        }

        let body: { event_type?: string; detail?: Record<string, unknown> } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ received: true, ignored: "payload inválido" });
        }

        const { logAndAlertSecurityEvent } = await import("@/lib/security.server");
        await logAndAlertSecurityEvent({
          eventType: (body.event_type as "kyc_self_approve_attempt") ?? "unauthorized_action",
          severity: "critical",
          detail: body.detail ?? {},
          userId: (body.detail?.["user_id"] as string | undefined) ?? null,
        });

        return Response.json({ received: true });
      },
      GET: () => Response.json({ endpoint: "security-alert", status: "ready" }),
    },
  },
});
