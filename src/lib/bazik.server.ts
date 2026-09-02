// Conector Bazik (bazik.io) — flujo de payout real, orientado a MonCash / NatCash.

export type BazikWallet = "moncash" | "natcash";

export type BazikTopupInput = {
  walletId: string;
  amount: number;
  currency: string;
  reference: string;
};

export type BazikPayoutInput = {
  provider: BazikWallet;
  phone: string;
  amount: number;
  currency: string;
  reference: string;
  firstName?: string;
  lastName?: string;
  description?: string;
};

export type BazikResult = {
  ok: boolean;
  configured: boolean;
  providerReference?: string;
  status?: string;
  error?: string;
};

type Creds = { baseUrl: string; userId?: string; apiKey?: string; apiSecret?: string };

export const BAZIK_CRED_NAMES = [
  "BAZIK_BASE_URL",
  "BAZIK_USER_ID",
  "BAZIK_SECRET_KEY",
  "BAZIK_WEBHOOK_SECRET",
  "BAZIK_PAYOUT_API_KEY",
  "BAZIK_PAYOUT_API_SECRET",
] as const;

export type BazikCredName = (typeof BAZIK_CRED_NAMES)[number];

export async function loadStoredCreds(): Promise<Record<string, string>> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("integration_credentials")
      .select("name, value")
      .in("name", [...BAZIK_CRED_NAMES]);
    const out: Record<string, string> = {};
    for (const row of data ?? []) if (row.value) out[row.name] = String(row.value).trim();
    return out;
  } catch (e) {
    console.error("No se pudieron leer las credenciales guardadas", e);
    return {};
  }
}

export async function saveStoredCred(name: string, value: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!value) {
    await supabaseAdmin.from("integration_credentials").delete().eq("name", name);
    return;
  }
  await supabaseAdmin
    .from("integration_credentials")
    .upsert({ name, value, updated_at: new Date().toISOString(), updated_by: userId });
}

function pick(stored: Record<string, string>, ...names: string[]) {
  for (const n of names) {
    const v =
      (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } })
        .process?.env?.[n] ?? stored[n];
    if (v) return v;
  }
  return undefined;
}

function baseUrlFrom(stored: Record<string, string>) {
  return (pick(stored, "BAZIK_BASE_URL") ?? "https://api.bazik.io").replace(/\/$/, "");
}

function credsFor(stored: Record<string, string>): Creds {
  const userId = pick(stored, "BAZIK_USER_ID");
  const key = pick(stored, "BAZIK_PAYOUT_API_KEY", "BAZIK_API_KEY");
  const secret = pick(stored, "BAZIK_PAYOUT_API_SECRET", "BAZIK_API_SECRET", "BAZIK_SECRET_KEY");

  return {
    baseUrl: baseUrlFrom(stored),
    ...(userId ? { userId } : {}),
    ...(key ? { apiKey: key } : {}),
    ...(secret ? { apiSecret: secret } : {}),
  };
}

export async function bazikWebhookSecret(): Promise<string | undefined> {
  const stored = await loadStoredCreds();
  return pick(stored, "BAZIK_WEBHOOK_SECRET");
}

export function bazikRequestCandidates() {
  return ["/transfers", "/payouts", "/v1/payouts", "/v1/transfers"];
}

export function bazikStatusLooksSuccessful(status?: string | null): boolean {
  const value = String(status ?? "")
    .trim()
    .toLowerCase();
  if (!value) return false;
  return (
    [
      "success",
      "succeeded",
      "completed",
      "paid",
      "approved",
      "confirmed",
      "processed",
      "sent",
      "finished",
    ].includes(value) ||
    value.includes("success") ||
    value.includes("complete") ||
    value.includes("paid")
  );
}

export function normaliseBazikResult(
  payload: unknown,
): Pick<BazikResult, "providerReference" | "status"> {
  const data = (payload ?? {}) as Record<string, unknown>;
  const nested = (data["data"] as Record<string, unknown> | undefined) ?? undefined;
  const transfer = (data["transfer"] as Record<string, unknown> | undefined) ?? undefined;
  const payout = (data["payout"] as Record<string, unknown> | undefined) ?? undefined;

  const providerReference =
    (data["id"] as string | undefined) ??
    (data["reference"] as string | undefined) ??
    (data["transaction_id"] as string | undefined) ??
    (data["transfer_id"] as string | undefined) ??
    (data["provider_ref"] as string | undefined) ??
    (nested?.["id"] as string | undefined) ??
    (nested?.["reference"] as string | undefined) ??
    (nested?.["transaction_id"] as string | undefined) ??
    (transfer?.["id"] as string | undefined) ??
    (transfer?.["reference"] as string | undefined) ??
    (payout?.["id"] as string | undefined) ??
    (payout?.["reference"] as string | undefined) ??
    null;

  const status =
    (data["status"] as string | undefined) ??
    (data["state"] as string | undefined) ??
    (data["transaction_status"] as string | undefined) ??
    (nested?.["status"] as string | undefined) ??
    (nested?.["state"] as string | undefined) ??
    (transfer?.["status"] as string | undefined) ??
    (payout?.["status"] as string | undefined) ??
    null;

  return {
    ...(providerReference ? { providerReference: String(providerReference) } : {}),
    ...(status ? { status: String(status) } : {}),
  };
}

export async function bazikStatusInfo() {
  const stored = await loadStoredCreds();
  const url = baseUrlFrom(stored);
  const payout = credsFor(stored);

  return {
    baseUrl: url,
    account: {
      hasUserId: Boolean(pick(stored, "BAZIK_USER_ID")),
      hasSecretKey: Boolean(pick(stored, "BAZIK_SECRET_KEY")),
      hasWebhookSecret: Boolean(pick(stored, "BAZIK_WEBHOOK_SECRET")),
    },
    configured: Boolean(payout.apiKey && payout.userId),
    payoutEndpoint: `${url}/transfers`,
    payout: {
      label: "API de payouts MonCash / NatCash",
      endpoint: `${url}/transfers`,
      keyName: "BAZIK_PAYOUT_API_KEY",
      secretName: "BAZIK_PAYOUT_API_SECRET",
      hasKey: Boolean(payout.apiKey),
      hasSecret: Boolean(payout.apiSecret),
    },
  };
}

export function bazikWebhookState(
  value?: string | null,
): "processing" | "completed" | "cancelled" | null {
  const v = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!v) return null;

  if (bazikStatusLooksSuccessful(value)) return "completed";
  if (
    ["pending", "processing", "in_progress", "queued", "submitted", "created", "awaiting"].includes(
      v,
    ) ||
    v.includes("process") ||
    v.includes("pending")
  ) {
    return "processing";
  }
  if (
    ["failed", "rejected", "cancelled", "canceled", "error", "refunded", "declined"].includes(v) ||
    v.includes("fail") ||
    v.includes("cancel")
  ) {
    return "cancelled";
  }
  return null;
}

export function bazikExtractReference(payload: unknown): string | null {
  const data = (payload ?? {}) as Record<string, unknown>;
  const nested = (data["data"] as Record<string, unknown> | undefined) ?? undefined;
  const transfer = (data["transfer"] as Record<string, unknown> | undefined) ?? undefined;
  const payout = (data["payout"] as Record<string, unknown> | undefined) ?? undefined;

  const candidate =
    (data["reference"] as string | undefined) ??
    (data["ref"] as string | undefined) ??
    (data["transaction_reference"] as string | undefined) ??
    (data["provider_reference"] as string | undefined) ??
    (data["providerRef"] as string | undefined) ??
    (data["external_reference"] as string | undefined) ??
    (nested?.["reference"] as string | undefined) ??
    (nested?.["ref"] as string | undefined) ??
    (transfer?.["reference"] as string | undefined) ??
    (payout?.["reference"] as string | undefined) ??
    (data["id"] as string | undefined);

  return candidate ? String(candidate).trim() : null;
}

const BAZIK_STATUS_TEXT: Record<
  "processing" | "completed" | "cancelled",
  { title: string; body: string }
> = {
  processing: {
    title: "Pago en proceso",
    body: "Bazik está procesando el envío a MonCash/NatCash.",
  },
  completed: {
    title: "Pago confirmado",
    body: "Bazik confirmó el envío y ya fue acreditado a la billetera móvil.",
  },
  cancelled: { title: "Pago rechazado", body: "Bazik no pudo completar el envío." },
};

export async function applyBazikResult(opts: {
  reference: string;
  state: string;
  providerRef?: string | null;
  detail?: string | null;
}) {
  const next = bazikWebhookState(opts.state);
  if (!next) return { ok: false, reason: `Estado no manejado: ${opts.state}` };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: transfer } = await supabaseAdmin
    .from("transfers")
    .select("id, user_id, status, reference")
    .eq("reference", opts.reference)
    .maybeSingle();

  if (!transfer) return { ok: false, reason: `No existe el envío ${opts.reference}` };
  if (transfer.status === next) return { ok: true, unchanged: true, transferId: transfer.id };
  if (["completed", "processing"].includes(transfer.status) && next === "completed") {
    return { ok: true, unchanged: true, transferId: transfer.id };
  }

  const { error } = await supabaseAdmin
    .from("transfers")
    .update({ status: next })
    .eq("id", transfer.id);

  if (error) {
    console.error("Bazik: no se pudo actualizar el envío", error);
    return { ok: false, reason: error.message };
  }

  await supabaseAdmin.from("transfer_events").insert({
    transfer_id: transfer.id,
    status: next,
    message: `Bazik: ${BAZIK_STATUS_TEXT[next].title}`,
  });

  await supabaseAdmin.from("notifications").insert({
    user_id: transfer.user_id,
    title: `${BAZIK_STATUS_TEXT[next].title} · ${transfer.reference}`,
    body: BAZIK_STATUS_TEXT[next].body,
  });

  return { ok: true, transferId: transfer.id, status: next };
}

async function callBazik(creds: Creds, paths: string[], body: unknown): Promise<BazikResult> {
  if (!creds.apiKey || !creds.userId) {
    return {
      ok: false,
      configured: true,
      error:
        "Falta la conexión de Bazik: necesita User ID + API Key en el panel de administración.",
    };
  }

  const payload = JSON.stringify(body);
  const headersBase = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${creds.apiSecret ?? creds.userId}`,
    "X-Api-Key": creds.apiKey,
    "X-API-Key": creds.apiKey,
    "X-User-Id": creds.userId,
  } as Record<string, string>;

  if (creds.apiSecret) {
    headersBase["X-Api-Secret"] = creds.apiSecret;
    headersBase["X-API-Secret"] = creds.apiSecret;
  }

  for (const path of paths) {
    try {
      const response = await fetch(`${creds.baseUrl}${path}`, {
        method: "POST",
        headers: headersBase,
        body: payload,
      });

      const text = await response.text();
      let parsed: unknown = text;
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        // response is plain text
      }

      if (!response.ok) {
        console.error(`Bazik ${path} falló [${response.status}]: ${text}`);
        continue;
      }

      const normalised = normaliseBazikResult(parsed);
      return {
        ok: true,
        configured: true,
        ...normalised,
      };
    } catch (error) {
      console.error(`Bazik ${path} lanzó error:`, error);
    }
  }

  return {
    ok: false,
    configured: true,
    error: `Bazik no respondió con ninguna ruta válida. Revisa la URL base y las credenciales: ${paths.join(", ")}`,
  };
}

/** Flujo simplificado de Bazik: solo payouts a MonCash/NatCash. */
export async function bazikTopup(_input: BazikTopupInput): Promise<BazikResult> {
  return {
    ok: false,
    configured: true,
    error:
      "Top-up deshabilitado. El sistema Bazik está configurado solo para payouts MonCash/NatCash.",
  };
}

export type BazikQuoteResult = BazikResult & {
  amount?: number;
  fee?: number;
  total?: number;
  provider?: BazikWallet;
};

/** Cotización real de un payout MonCash/NatCash antes de confirmarlo. */
export async function bazikQuote(amount: number, provider: BazikWallet): Promise<BazikQuoteResult> {
  const stored = await loadStoredCreds();
  const creds = credsFor(stored);

  if (!creds.apiKey || !creds.userId) {
    return {
      ok: false,
      configured: true,
      error:
        "Falta la conexión de Bazik: necesita User ID + API Key en el panel de administración.",
    };
  }

  const result = await callBazik(creds, ["/quotes", "/v1/quotes", "/quote"], {
    provider,
    amount,
  });

  if (!result.ok) return result;

  return { ...result, amount, provider };
}

export async function bazikPayout(input: BazikPayoutInput): Promise<BazikResult> {
  const stored = await loadStoredCreds();
  const creds = credsFor(stored);
  const wallet = input.phone.replace(/\D/g, "");
  const normalized = wallet.startsWith("509") ? wallet : `509${wallet.slice(-8)}`;

  return callBazik(creds, bazikRequestCandidates(), {
    provider: input.provider,
    destination: normalized,
    wallet: normalized,
    amount: input.amount,
    currency: input.currency,
    reference: input.reference,
    description: input.description ?? `Lajan Rapid ${input.reference}`,
  });
}
