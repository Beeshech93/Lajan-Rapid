import { createFileRoute } from "@tanstack/react-router";

/** Callback de Bazik para envíos MonCash / NatCash (payouts). */
export const Route = createFileRoute("/api/public/bazik/payout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const raw = await request.text();

        let body: Record<string, any> = {};
        try {
          body = JSON.parse(raw) as Record<string, any>;
        } catch {
          // payload puede no venir en JSON
        }

        const { bazikExtractReference, bazikWebhookSecret, applyBazikResult } = await import(
          "@/lib/bazik.server",
        );
        const secret = await bazikWebhookSecret();
        if (secret) {
          const provided = request.headers.get("x-bazik-signature");
          const sharedSecret = request.headers.get("x-webhook-secret") ?? url.searchParams.get("secret");
          const validSignature = Boolean(provided && provided === secret);
          const validShared = Boolean(sharedSecret && sharedSecret === secret);
          if (!validSignature && !validShared) {
            return new Response("Invalid signature", { status: 401 });
          }
        }

        const payload = (body && Object.keys(body).length > 0 ? body : (JSON.parse(raw || "{}") as Record<string, any>));
        const reference = bazikExtractReference(payload) ?? url.searchParams.get("reference");
        const state =
          String(
            payload["status"] ??
              payload["state"] ??
              payload["transaction_status"] ??
              payload["status_detail"] ??
              payload["data"]?.["status"] ??
              payload["transfer"]?.["status"] ??
              payload["payout"]?.["status"] ??
              "",
          ).trim();

        if (!reference || !state) {
          return Response.json({ received: true, ignored: "sin referencia o estado" });
        }

        const result = await applyBazikResult({
          reference,
          state,
          providerRef: payload["provider_reference"] ?? payload["providerRef"] ?? payload["id"] ?? null,
          detail: payload["detail"] ?? payload["message"] ?? null,
        });

        if (!result.ok) console.warn("Bazik payout webhook:", result.reason);

        return Response.json({ received: true });
      },
      GET: () => Response.json({ endpoint: "bazik-payout", status: "ready" }),
    },
  },
});
