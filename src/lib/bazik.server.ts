// Conector Bazik (bazik.io) — capa de acceso al proveedor.
// Dos puntos de conexión: recarga de billetera y envío a MonCash / NatCash.

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
};

export type BazikResult = {
  ok: boolean;
  configured: boolean;
  providerReference?: string;
  status?: string;
  error?: string;
};

function config() {
  const baseUrl = process.env["BAZIK_BASE_URL"] ?? "https://api.bazik.io";
  const apiKey = process.env["BAZIK_API_KEY"];
  return { baseUrl: baseUrl.replace(/\/$/, ""), apiKey };
}

/** Estado de la conexión Bazik para el panel de administración. */
export function bazikStatusInfo() {
  const { baseUrl, apiKey } = config();
  return {
    configured: Boolean(apiKey),
    baseUrl,
    topupEndpoint: `${baseUrl}/v1/collections`,
    payoutEndpoint: `${baseUrl}/v1/payouts`,
  };
}


async function callBazik(path: string, body: unknown): Promise<BazikResult> {
  const { baseUrl, apiKey } = config();
  if (!apiKey) {
    // Punto de conexión listo: en cuanto se configure BAZIK_API_KEY empieza a operar.
    return { ok: false, configured: false, error: "BAZIK_API_KEY no configurada" };
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    /* respuesta no JSON */
  }

  if (!response.ok) {
    console.error(`Bazik ${path} falló [${response.status}]: ${text}`);
    return { ok: false, configured: true, error: `Bazik [${response.status}]: ${text}` };
  }

  const data = parsed as { id?: string; reference?: string; status?: string };
  return {
    ok: true,
    configured: true,
    ...(data.id || data.reference ? { providerReference: data.id ?? data.reference! } : {}),
    ...(data.status ? { status: data.status } : {}),
  };
}

/** Punto de conexión #1 — recargar la billetera del cliente vía Bazik. */
export function bazikTopup(input: BazikTopupInput) {
  return callBazik("/v1/collections", {
    amount: input.amount,
    currency: input.currency,
    reference: input.reference,
    metadata: { wallet_id: input.walletId },
  });
}

/** Punto de conexión #2 — enviar dinero a MonCash o NatCash vía Bazik. */
export function bazikPayout(input: BazikPayoutInput) {
  return callBazik("/v1/payouts", {
    provider: input.provider,
    destination: input.phone,
    amount: input.amount,
    currency: input.currency,
    reference: input.reference,
  });
}
