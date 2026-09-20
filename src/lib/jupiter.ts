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

export type ScaledUiConfig = {
  multiplier: number;
  newMultiplier?: number;
  newMultiplierEffectiveAt?: string;
};

export type JupiterPrice = {
  usdPrice?: number;
  liquidity?: number;
  blockId?: number;
  decimals?: number;
  priceChange24h?: number;
  stockData?: { id: string; price: number; mcap?: number; updatedAt: string };
  scaledUiConfig?: ScaledUiConfig;
};

/**
 * UI amount per raw unit for scaled-UI mints (every xStock). Jupiter keeps
 * reporting the old `multiplier` after a scheduled change; the chain uses
 * `newMultiplier` once its effective time has passed. Using the stale one
 * makes "sell all" ask for more raw units than the wallet holds (error 0x1788).
 */
export function effectiveMultiplier(
  price: { scaledUiConfig?: ScaledUiConfig } | undefined,
  /** The moment to read it as of; a past trade needs the rate it was made under. */
  asOf: number = Date.now(),
): number {
  return multiplierOf(price?.scaledUiConfig, asOf);
}

/** The same rule, for a config read back out of the database. */
export function multiplierOf(
  config: ScaledUiConfig | null | undefined,
  asOf: number = Date.now(),
): number {
  if (!config) return 1;
  const at = config.newMultiplierEffectiveAt
    ? Date.parse(config.newMultiplierEffectiveAt)
    : NaN;
  if (config.newMultiplier && Number.isFinite(at) && at <= asOf)
    return config.newMultiplier;
  return config.multiplier ?? 1;
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} for ${url}`);
  }
  return (await res.json()) as T;
}

export async function searchTokens(
  query: string,
): Promise<JupiterSearchToken[]> {
  return getJson<JupiterSearchToken[]>(
    `${LITE}/tokens/v2/search?query=${encodeURIComponent(query)}`,
  );
}

export async function getPrices(
  mints: string[],
): Promise<Record<string, JupiterPrice>> {
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
    // V2 route instructions: needed to take the platform fee on Token-2022
    // mints (every xStock); V1 fails onchain with 6014 IncorrectTokenProgramID.
    instructionVersion: "V2",
  });
  if (params.platformFeeBps)
    search.set("platformFeeBps", String(params.platformFeeBps));
  const res = await fetch(`${LITE}/swap/v1/quote?${search}`, {
    signal: AbortSignal.timeout(15000),
  });
  const body = (await res.json()) as Quote;
  if (!res.ok || body.error) return null;
  return body;
}
