import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook de Stripe.
 * Verifica la cabecera `Stripe-Signature`, reconsulta el evento en la API
 * y actualiza el estado del envío + notifica al usuario.
 */
export const Route = createFileRoute("/api/public/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();

        const { verifyStripeSignature, fetchStripeEvent, applyStripeEvent } =
          await import("@/lib/stripe.server");

        const verified = await verifyStripeSignature({
          signatureHeader:
            request.headers.get("stripe-signature") ?? request.headers.get("Stripe-Signature"),
          rawBody: raw,
        });
        if (!verified.ok) {
          console.error("Stripe webhook rechazado:", verified.reason);
          const { logAndAlertSecurityEvent } = await import("@/lib/security.server");
          await logAndAlertSecurityEvent({
            eventType: "webhook_invalid_signature",
            detail: { webhook: "stripe", reason: verified.reason },
          });
          return new Response("Invalid signature", { status: 401 });
        }

        let body: { id?: string; type?: string; data?: { object?: Record<string, unknown> } } = {};
        try {
          body = JSON.parse(raw) as typeof body;
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }
        if (!body.id) return Response.json({ received: true, ignored: "sin id de evento" });

        // Reconsulta en Stripe; si no hay clave secreta, usa el cuerpo ya verificado por firma.
        const event =
          (await fetchStripeEvent(body.id)) ??
          ({
            id: body.id,
            type: body.type ?? "",
            data: { object: (body.data?.object ?? {}) as Record<string, unknown> },
          } as const);

        const result = await applyStripeEvent(event);
        if (!result.ok)
          console.warn("Stripe webhook:", "reason" in result ? result.reason : result);

        return Response.json({ received: true });
      },
      GET: () => Response.json({ endpoint: "stripe-webhook", status: "ready" }),
    },
  },
});
