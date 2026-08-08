import { createFileRoute } from "@tanstack/react-router";

/** Callback de Bazik para recargas de billetera (collections). */
export const Route = createFileRoute("/api/public/bazik/topup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["BAZIK_WEBHOOK_SECRET"];
        if (secret) {
          const provided = request.headers.get("x-bazik-signature");
          if (provided !== secret) {
            return new Response("Invalid signature", { status: 401 });
          }
        }
        const body = await request.text();
        console.log("Bazik topup callback:", body.slice(0, 2000));
        return Response.json({ received: true });
      },
      GET: () => Response.json({ endpoint: "bazik-topup", status: "ready" }),
    },
  },
});
