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

/** Callback de Bazik para resultados de transferencias MonCash/NatCash. */
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

        const {
          bazikExtractReference,
          bazikWebhookSecret,
          applyBazikResult,
          registerBazikWebhookEvent,
          finishBazikWebhookEvent,
        } = await import("@/lib/bazik.server");
        const { logAndAlertSecurityEvent } = await import("@/lib/security.server");
        const timestamp = request.headers.get("x-bazik-timestamp");
        const eventId = request.headers.get("x-bazik-event-id");
        const environment = request.headers.get("x-bazik-env")?.toLowerCase() ?? null;
        const provided = request.headers.get("x-bazik-signature");
        const configuredEnvironment = (process.env.BAZIK_ENVIRONMENT ?? "sandbox").toLowerCase();
        const expectedEnvironment =
          configuredEnvironment === "production" || configuredEnvironment === "live" ? "live" : "sandbox";

        if (environment !== expectedEnvironment) {
          return new Response("Invalid webhook environment", { status: 401 });
        }
        const secret = await bazikWebhookSecret(expectedEnvironment);
        if (!secret) {
          console.error("Bazik webhook: no hay secreto configurado para el entorno, rechazando");
          await logAndAlertSecurityEvent({
            eventType: "webhook_not_configured",
            severity: "critical",
            detail: { webhook: "bazik", environment: expectedEnvironment },
          });
          return new Response("Webhook not configured", { status: 401 });
        }
        const timestampSeconds = timestamp && /^\d+$/.test(timestamp) ? Number(timestamp) : NaN;
        const nowSeconds = Math.floor(Date.now() / 1000);
        if (
          !Number.isFinite(timestampSeconds) ||
          Math.abs(nowSeconds - timestampSeconds) > 300 ||
          !eventId ||
          eventId.length > 200
        ) {
          return new Response("Invalid webhook headers", { status: 401 });
        }

        let validSignature = false;
        try {
          validSignature = await verifyBazikHmac(raw, timestamp, eventId, provided, secret);
        } catch {
          console.error("Bazik webhook: error verificando HMAC");
        }
        if (!validSignature) {
          await logAndAlertSecurityEvent({
            eventType: "webhook_invalid_signature",
            detail: { webhook: "bazik", ip: request.headers.get("x-forwarded-for") },
          });
          return new Response("Invalid signature", { status: 401 });
        }

        // This endpoint updates outgoing transfers only; payment events must not alter withdrawals.
        const eventType = String(payload["type"] ?? "").trim().toLowerCase();
        if (eventType !== "transfer.succeeded" && eventType !== "transfer.failed") {
          return new Response("Unsupported webhook event", { status: 400 });
        }

        const nestedData = payload["data"];
        if (nestedData !== undefined && (!nestedData || typeof nestedData !== "object" || Array.isArray(nestedData))) {
          return new Response("Invalid transfer payload", { status: 400 });
        }
        const data = (nestedData && typeof nestedData === "object" ? nestedData : payload) as Record<string, unknown>;
        const transactionId = data["transactionId"] ?? data["transaction_id"] ?? payload["transactionId"] ?? payload["transaction_id"];
        const amount = data["amount"] ?? payload["amount"];
        const currency = data["currency"] ?? payload["currency"];
        const provider = data["provider"] ?? payload["provider"];
        if (
          typeof transactionId !== "string" || !transactionId.trim() ||
          typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 ||
          typeof currency !== "string" || currency.trim().toUpperCase() !== "HTG" ||
          typeof provider !== "string" || !["moncash", "natcash"].includes(provider.trim().toLowerCase())
        ) {
          return new Response("Invalid transfer details", { status: 400 });
        }

        const nestedPayload = payload["data"] && typeof payload["data"] === "object" && !Array.isArray(payload["data"])
          ? payload["data"] as Record<string, unknown>
          : payload;
        const status = String(nestedPayload["status"] ?? payload["status"] ?? "").toLowerCase();
        const expectedStatus = eventType === "transfer.succeeded" ? "successful" : "failed";
        if (status !== expectedStatus) {
          return new Response("Event type and transfer status do not match", { status: 400 });
        }
        const reference = bazikExtractReference(payload);
        if (!reference) {
          // Return non-2xx so the provider/operator can investigate instead of silently acknowledging it.
          return new Response("Missing transfer reference", { status: 400 });
        }

        // The event type is authoritative for final status; don't let a conflicting payload
        // status turn a failed event into success (or vice versa).
        const state = eventType === "transfer.succeeded" ? "succeeded" : "failed";
        const payloadDigest = toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)));
        const ledger = await registerBazikWebhookEvent({
          environment: expectedEnvironment,
          eventId: eventId!,
          eventType,
          reference,
          payloadSha256: payloadDigest,
        });
        if (!ledger.ok) {
          if (ledger.conflict) {
            await logAndAlertSecurityEvent({
              eventType: "webhook_event_id_payload_conflict",
              severity: "high",
              detail: { webhook: "bazik", eventId, reference },
            });
            return new Response("Conflicting event ID", { status: 409 });
          }
          return new Response("Webhook event not ready for processing", { status: 500 });
        }
        if (ledger.duplicate) {
          return Response.json({ received: true, duplicate: true });
        }

        const nested = payload["data"] as Record<string, unknown> | undefined;
        const providerRef = transactionId;
        const detail = nested?.["failureReason"] ?? payload["failureReason"] ?? payload["detail"] ?? payload["message"];

        const result = await applyBazikResult({
          reference,
          state,
          providerRef: String(providerRef),
          amount,
          currency: currency.trim().toUpperCase(),
          provider: provider.trim().toLowerCase() as "moncash" | "natcash",
          detail: detail != null ? String(detail) : null,
        });

        if (!result.ok) {
          console.warn("Bazik payout webhook processing failed:", result.reason);
          await finishBazikWebhookEvent({
            environment: expectedEnvironment,
            eventId: eventId!,
            processed: false,
            error: result.reason,
          });
          return new Response("Webhook processing failed", { status: 500 });
        }

        const finalized = await finishBazikWebhookEvent({
          environment: expectedEnvironment,
          eventId: eventId!,
          processed: true,
        });
        if (!finalized) {
          // Return non-2xx to make the provider retry; the event ledger will prevent
          // a second state transition if the transfer was already finalized.
          return new Response("Webhook ledger finalization failed", { status: 500 });
        }

        return Response.json({ received: true, duplicate: Boolean(result.unchanged) });
      },
      GET: () => Response.json({ endpoint: "bazik-payout", status: "ready" }),
    },
  },
});
