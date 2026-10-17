import { createFileRoute } from "@tanstack/react-router";

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Bazik signs: timestamp.eventId.rawBody using HMAC-SHA256.
 * Signature header format documented by Bazik: v1=<hex digest>.
 */
async function verifyBazikHmac(
  rawBody: string,
  timestamp: string | null,
  eventId: string | null,
  provided: string | null,
  secret: string,
): Promise<boolean> {
  if (!timestamp || !eventId || !provided || !secret) return false;
  const supplied = provided.trim().toLowerCase();
  if (!/^v1=[0-9a-f]{64}$/.test(supplied)) return false;

  const signedPayload = `${timestamp}.${eventId}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const expected = `v1=${toHex(signature)}`;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) {
    difference |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  }
  return difference === 0;
}

/** Callback de Bazik para resultados de pagos MonCash/NatCash. */
export const Route = createFileRoute("/api/public/bazik/payout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();

        let payload: Record<string, unknown>;
        try {
          const parsed: unknown = JSON.parse(raw);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return new Response("Invalid JSON payload", { status: 400 });
          }
          payload = parsed as Record<string, unknown>;
        } catch {
          return new Response("Invalid JSON payload", { status: 400 });
        }

        const { bazikExtractReference, bazikWebhookSecret, applyBazikResult } =
          await import("@/lib/bazik.server");
        const { logAndAlertSecurityEvent } = await import("@/lib/security.server");
        const secret = await bazikWebhookSecret();
        if (!secret) {
          console.error("Bazik webhook: BAZIK_WEBHOOK_SECRET no configurado, rechazando");
          await logAndAlertSecurityEvent({
            eventType: "webhook_not_configured",
            severity: "critical",
            detail: { webhook: "bazik" },
          });
          return new Response("Webhook not configured", { status: 401 });
        }

        // Bazik signs timestamp.eventId.rawBody; reject stale timestamps to limit replay.
        const timestamp = request.headers.get("x-bazik-timestamp");
        const eventId = request.headers.get("x-bazik-event-id");
        const environment = request.headers.get("x-bazik-env");
        const provided = request.headers.get("x-bazik-signature");
        const expectedEnvironment = process.env.BAZIK_ENVIRONMENT === "live" ? "live" : "sandbox";
        const timestampSeconds = timestamp && /^\d+$/.test(timestamp) ? Number(timestamp) : NaN;
        const nowSeconds = Math.floor(Date.now() / 1000);
        if (
          environment !== expectedEnvironment ||
          !Number.isFinite(timestampSeconds) ||
          Math.abs(nowSeconds - timestampSeconds) > 300 ||
          !eventId
        ) {
          return new Response("Invalid webhook headers", { status: 401 });
        }

        let validSignature = false;
        try {
          validSignature = await verifyBazikHmac(raw, timestamp, eventId, provided, secret);
        } catch (error) {
          console.error("Bazik webhook: error verificando HMAC");
        }
        if (!validSignature) {
          await logAndAlertSecurityEvent({
            eventType: "webhook_invalid_signature",
            detail: { webhook: "bazik", ip: request.headers.get("x-forwarded-for") },
          });
          return new Response("Invalid signature", { status: 401 });
        }

        const nested = payload["data"] as Record<string, unknown> | undefined;
        const withdrawal = payload["withdrawal"] as Record<string, unknown> | undefined;
        const reference = bazikExtractReference(payload);
        const state = String(
          payload["status"] ??
            payload["state"] ??
            nested?.["status"] ??
            withdrawal?.["status"] ??
            "",
        ).trim();

        if (!reference || !state) {
          return Response.json({ received: true, ignored: "sin referencia o estado" });
        }

        const providerRef =
          payload["id"] ?? payload["transactionId"] ?? payload["transaction_id"];
        const detail = payload["detail"] ?? payload["message"];

        const result = await applyBazikResult({
          reference,
          state,
          providerRef: providerRef != null ? String(providerRef) : null,
          detail: detail != null ? String(detail) : null,
        });

        if (!result.ok) {
          console.warn("Bazik payout webhook:", result.reason);
          return new Response("Webhook processing failed", { status: 500 });
        }

        return Response.json({ received: true });
      },
      GET: () => Response.json({ endpoint: "bazik-payout", status: "ready" }),
    },
  },
});
