// GeckoTerminal public API: free hourly candles per pool, no key.
// Limit is about 30 requests per minute, so callers must pace themselves.

const BASE = "https://api.geckoterminal.com/api/v2/networks/solana";

type PoolsResponse = {
  data: {
    attributes: { address: string; name: string; reserve_in_usd: string; volume_usd: { h24: string } };
  }[];
};

type OhlcvResponse = {
  data: { attributes: { ohlcv_list: [number, number, number, number, number, number][] } };
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`GeckoTerminal ${res.status} for ${url}`);
  return (await res.json()) as T;
}

/** Deepest pool for a token, or null when GeckoTerminal has none. */
export async function topPoolFor(mint: string): Promise<string | null> {
  const body = await getJson<PoolsResponse>(`${BASE}/tokens/${mint}/pools?page=1`);
  const best = body.data
    .map((p) => ({ address: p.attributes.address, reserve: Number(p.attributes.reserve_in_usd) }))
    .sort((a, b) => b.reserve - a.reserve)[0];
  return best?.address ?? null;
}

export type Candle = { ts: number; open: number; high: number; low: number; close: number; volume: number };

export async function hourlyCandles(pool: string, limit = 168): Promise<Candle[]> {
  const body = await getJson<OhlcvResponse>(
    `${BASE}/pools/${pool}/ohlcv/hour?aggregate=1&limit=${limit}`,
  );
  return body.data.attributes.ohlcv_list
    .map(([t, o, h, l, c, v]) => ({ ts: t * 1000, open: o, high: h, low: l, close: c, volume: v }))
    .sort((a, b) => a.ts - b.ts);
}
