import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook de DingConnect (notificaciones de estado de recargas).
 * Verifica la firma / secreto compartido y actualiza la recarga,
 * devolviendo el saldo y notificando al usuario si falla.
 */
export const Route = createFileRoute("/api/public/dingconnect/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const raw = await request.text();

        let body: Record<string, unknown> = {};
        try {
          body = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          /* cuerpo no JSON */
        }

        const { verifyDingWebhook, applyDingResult } = await import("@/lib/dingconnect.server");

        const verified = await verifyDingWebhook({
          signatureHeader: request.headers.get("x-signature"),
          sharedSecretHeader:
            request.headers.get("x-webhook-secret") ?? url.searchParams.get("secret"),
          rawBody: raw,
        });
        if (!verified.ok) {
          console.error("DingConnect webhook rechazado:", verified.reason);
          return new Response("Invalid signature", { status: 401 });
        }

        const record = (body["TransferRecord"] ?? body) as Record<string, unknown>;
        const reference = String(
          record["DistributorRef"] ?? body["DistributorRef"] ?? url.searchParams.get("ref") ?? "",
        ).trim();
        const state = String(
          record["ProcessingState"] ?? body["ProcessingState"] ?? body["Status"] ?? "",
        ).trim();

        if (!reference || !state) {
          return Response.json({ received: true, ignored: "sin referencia o estado" });
        }

        const result = await applyDingResult({
          reference,
          state,
          providerRef: record["TransferId"] ? String(record["TransferId"]) : null,
          detail: record["ErrorCodes"] ? JSON.stringify(record["ErrorCodes"]) : null,
        });
        if (!result.ok) console.warn("DingConnect webhook:", result.reason);

        return Response.json({ received: true });
      },
      GET: () => Response.json({ endpoint: "dingconnect-webhook", status: "ready" }),
    },
  },
});
