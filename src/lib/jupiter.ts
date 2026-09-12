// Thin client for Jupiter's lite API. No key required.

const LITE = "https://lite-api.jup.ag";
const PRICE_BATCH = 50; // price v3 silently caps at 50 ids per call

export type JupiterSearchToken = {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  icon?: string;
  tags?: string[];
  liquidity?: number;
  usdPrice?: number;
  holderCount?: number;
  isVerified?: boolean;
  tokenProgram?: string;
  stats24h?: { priceChange?: number; buyVolume?: number; sellVolume?: number };
};

export type JupiterPrice = {
  usdPrice?: number;
  liquidity?: number;
  blockId?: number;
  decimals?: number;
  priceChange24h?: number;
  stockData?: { id: string; price: number; mcap?: number; updatedAt: string };
  scaledUiConfig?: { multiplier: number };
};

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} for ${url}`);
  }
  return (await res.json()) as T;
}

export async function searchTokens(query: string): Promise<JupiterSearchToken[]> {
  return getJson<JupiterSearchToken[]>(
    `${LITE}/tokens/v2/search?query=${encodeURIComponent(query)}`,
  );
}

export async function getPrices(mints: string[]): Promise<Record<string, JupiterPrice>> {
  const out: Record<string, JupiterPrice> = {};
  for (let i = 0; i < mints.length; i += PRICE_BATCH) {
    const chunk = mints.slice(i, i + PRICE_BATCH);
    const part = await getJson<Record<string, JupiterPrice | null>>(
      `${LITE}/price/v3?ids=${chunk.join(",")}`,
    );
    for (const [mint, price] of Object.entries(part)) {
      if (price) out[mint] = price;
    }
  }
  return out;
}

export type Quote = {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  priceImpactPct: string;
  slippageBps: number;
  routePlan: { swapInfo: { label: string; ammKey: string }; percent: number }[];
  error?: string;
  errorCode?: string;
};

export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export async function getQuote(params: {
  inputMint: string;
  outputMint: string;
  amount: bigint;
  slippageBps?: number;
  platformFeeBps?: number;
}): Promise<Quote | null> {
  const search = new URLSearchParams({
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.amount.toString(),
    slippageBps: String(params.slippageBps ?? 50),
    maxAccounts: "33",
  });
  if (params.platformFeeBps) search.set("platformFeeBps", String(params.platformFeeBps));
  const res = await fetch(`${LITE}/swap/v1/quote?${search}`, {
    signal: AbortSignal.timeout(15000),
  });
  const body = (await res.json()) as Quote;
  if (!res.ok || body.error) return null;
  return body;
}
