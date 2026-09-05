import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook de Mercado Pago (notificaciones IPN / Webhooks v2).
 * Verifica la firma `x-signature`, consulta el pago real en la API
 * y actualiza el estado del envío + notifica al usuario.
 */
export const Route = createFileRoute("/api/public/mercadopago/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const raw = await request.text();

        let body: { type?: string; action?: string; data?: { id?: string | number } } = {};
        try {
          body = JSON.parse(raw) as typeof body;
        } catch {
          /* Mercado Pago también puede enviar solo query params */
        }

        const dataId =
          (body.data?.id !== undefined ? String(body.data.id) : null) ??
          url.searchParams.get("data.id") ??
          url.searchParams.get("id");

        const topic = body.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic");

        const { verifyMpSignature, fetchMpPayment, applyMpPayment } =
          await import("@/lib/mercadopago.server");

        const verified = await verifyMpSignature({
          signatureHeader: request.headers.get("x-signature"),
          requestId: request.headers.get("x-request-id"),
          dataId,
        });
        if (!verified.ok) {
          console.error("Mercado Pago webhook rechazado:", verified.reason);
          const { logAndAlertSecurityEvent } = await import("@/lib/security.server");
          await logAndAlertSecurityEvent({
            eventType: "webhook_invalid_signature",
            detail: { webhook: "mercadopago", reason: verified.reason },
          });
          return new Response("Invalid signature", { status: 401 });
        }

        if (topic && topic !== "payment") {
          return Response.json({ received: true, ignored: topic });
        }
        if (!dataId) return Response.json({ received: true, ignored: "sin data.id" });

        const payment = await fetchMpPayment(dataId);
        if (!payment) {
          // 500 → Mercado Pago reintenta la notificación.
          return new Response("Payment lookup failed", { status: 500 });
        }

        const result = await applyMpPayment(payment);
        if (!result.ok)
          console.warn("Mercado Pago webhook:", "reason" in result ? result.reason : result);

        return Response.json({ received: true });
      },
      GET: () => Response.json({ endpoint: "mercadopago-webhook", status: "ready" }),
    },
  },
});
