import { createFileRoute } from "@tanstack/react-router";

/** Callback de Bazik para envíos MonCash / NatCash (payouts). */
export const Route = createFileRoute("/api/public/bazik/payout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { bazikWebhookSecret } = await import("@/lib/bazik.server");
        const secret = await bazikWebhookSecret();
        if (secret) {
          const provided = request.headers.get("x-bazik-signature");
          if (provided !== secret) {
            return new Response("Invalid signature", { status: 401 });
          }
        }
        const body = await request.text();
        console.log("Bazik payout callback:", body.slice(0, 2000));
        return Response.json({ received: true });
      },
      GET: () => Response.json({ endpoint: "bazik-payout", status: "ready" }),
    },
  },
});
