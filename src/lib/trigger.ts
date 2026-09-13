// Jupiter Trigger V1 (limit orders) on the lite API: non-custodial, the order
// lives in a program account owned by the user's wallet, no API key needed.
// We only build transactions here; the browser signs and sends them.
//   Buy below: "buy SYMBOL if the onchain price reaches X USD". Making amount
//   is USDC, taking amount is the shares that X implies.

const LITE = "https://lite-api.jup.ag/trigger/v1";

export type CreatedOrder = { order: string; requestId: string; transaction: string };

export type TriggerOrderRaw = {
  orderKey?: string;
  publicKey?: string;
  inputMint: string;
  outputMint: string;
  makingAmount: string;
  takingAmount: string;
  rawMakingAmount?: string;
  rawTakingAmount?: string;
  remainingMakingAmount?: string;
  remainingTakingAmount?: string;
  expiredAt?: string | number | null;
  createdAt?: string;
  status?: string;
  trades?: unknown[];
};

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${LITE}/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json()) as T & { error?: string; message?: string; code?: number };
  if (!res.ok || (json.code != null && json.code !== 0)) {
    throw new Error(json.error ?? json.message ?? `trigger ${path} ${res.status}`);
  }
  return json;
}

export async function createTriggerOrder(params: {
  inputMint: string;
  outputMint: string;
  maker: string;
  makingAmount: bigint;
  takingAmount: bigint;
  expiredAt?: number; // unix seconds
}): Promise<CreatedOrder> {
  return post<CreatedOrder>("createOrder", {
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    maker: params.maker,
    payer: params.maker,
    params: {
      makingAmount: params.makingAmount.toString(),
      takingAmount: params.takingAmount.toString(),
      ...(params.expiredAt ? { expiredAt: String(params.expiredAt) } : {}),
    },
    computeUnitPrice: "auto",
  });
}

export async function cancelTriggerOrder(maker: string, order: string): Promise<{ transaction: string; requestId: string }> {
  return post<{ transaction: string; requestId: string }>("cancelOrder", { maker, order, computeUnitPrice: "auto" });
}

export async function listTriggerOrders(user: string, status: "active" | "history" = "active"): Promise<TriggerOrderRaw[]> {
  const res = await fetch(`${LITE}/getTriggerOrders?user=${user}&orderStatus=${status}`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`trigger orders ${res.status}`);
  const json = (await res.json()) as { orders?: TriggerOrderRaw[] };
  return json.orders ?? [];
}
