// The /curves page: Meteora DBC launch pools quoted in tokenized stocks,
// grouped by stock, priced in USD through our own onchain stock price.

import { getMeta, listTokens } from "./db.ts";
import { listConfigs, listPools, type DbcPoolRow } from "./dbc-db.ts";
import { getRadar } from "./radar.ts";
import type { Tradability } from "./radar-types.ts";
import { isOffensive } from "./profanity.ts";

export type CurvePool = {
  pool: string;
  baseMint: string;
  name: string;
  symbol: string | null;
  image: string | null;
  creator: string;
  progress: number;
  migrated: boolean;
  /** Quote token raised so far, in stock units. */
  raisedQuote: number;
  raisedUsd: number | null;
  /** Launch-token price in stock units and USD. */
  priceQuote: number | null;
  priceUsd: number | null;
  feesQuote: number;
  feesUsd: number | null;
  finishedAt: number | null;
};

export type CurveStock = {
  mint: string;
  symbol: string;
  name: string;
  underlying: string;
  logo: string | null;
  price: number | null;
  tradability: Tradability;
  ageMs: number | null;
  configs: number;
  pools: CurvePool[];
  live: number;
  graduated: number;
  raisedQuote: number;
  raisedUsd: number;
  feesUsd: number;
};

export type CurvesOverview = {
  stocks: CurveStock[];
  totals: {
    /** Pools hidden for offensive names. */
    hidden: number;
    stocksUsed: number;
    configs: number;
    pools: number;
    live: number;
    graduated: number;
    raisedUsd: number;
    feesUsd: number;
  };
  scannedAt: number | null;
  /** Age of the last full scan, computed here so the page stays pure. */
  scannedAgoMs: number | null;
};

/** Metadata images often use the ipfs scheme, which browsers cannot fetch. */
export function imageUrl(raw: string | null): string | null {
  if (!raw) return null;
  const m = raw.match(/^ipfs:\/\/(?:ipfs\/)?(.+)$/i);
  return m ? `https://ipfs.io/ipfs/${m[1]}` : raw;
}

function toPool(
  p: DbcPoolRow,
  decimals: number,
  price: number | null,
): CurvePool {
  const raisedQuote = Number(p.quote_reserve) / 10 ** decimals;
  const feesQuote = Number(p.trading_quote_fee) / 10 ** decimals;
  return {
    pool: p.pool,
    baseMint: p.base_mint,
    name: p.name ?? "(name pending)",
    symbol: p.symbol,
    image: imageUrl(p.image),
    creator: p.creator,
    progress: p.is_migrated ? 1 : p.progress,
    migrated: p.is_migrated === 1,
    raisedQuote,
    raisedUsd: price != null ? raisedQuote * price : null,
    priceQuote: p.price_quote,
    priceUsd:
      price != null && p.price_quote != null ? p.price_quote * price : null,
    feesQuote,
    feesUsd: price != null ? feesQuote * price : null,
    finishedAt: p.finish_ts ? p.finish_ts * 1000 : null,
  };
}

export async function curvesOverview(): Promise<CurvesOverview> {
  const tokens = new Map(listTokens().map((t) => [t.mint, t]));
  const radar = new Map(getRadar().rows.map((r) => [r.mint, r]));
  const configs = listConfigs();
  const pools = listPools();
  const configCount = new Map<string, number>();
  for (const c of configs)
    configCount.set(c.quote_mint, (configCount.get(c.quote_mint) ?? 0) + 1);

  const byStock = new Map<string, CurveStock>();
  let hidden = 0;
  for (const p of pools) {
    const t = tokens.get(p.quote_mint);
    if (!t) continue;
    if (isOffensive(p.name, p.symbol)) {
      hidden++;
      continue;
    }
    const r = radar.get(p.quote_mint);
    let s = byStock.get(p.quote_mint);
    if (!s) {
      s = {
        mint: t.mint,
        symbol: t.symbol,
        name: t.name,
        underlying: t.underlying,
        logo: t.logo ?? null,
        price: r?.price ?? null,
        tradability: r?.tradability ?? "none",
        ageMs: r?.ageMs ?? null,
        configs: configCount.get(p.quote_mint) ?? 0,
        pools: [],
        live: 0,
        graduated: 0,
        raisedQuote: 0,
        raisedUsd: 0,
        feesUsd: 0,
      };
      byStock.set(p.quote_mint, s);
    }
    const cp = toPool(p, t.decimals, s.price);
    s.pools.push(cp);
    if (cp.migrated) s.graduated++;
    else if (cp.progress > 0) s.live++;
    s.raisedQuote += cp.raisedQuote;
    s.raisedUsd += cp.raisedUsd ?? 0;
    s.feesUsd += cp.feesUsd ?? 0;
  }
  const stocks = [...byStock.values()].sort(
    (a, b) => b.raisedUsd - a.raisedUsd || b.pools.length - a.pools.length,
  );
  for (const s of stocks) {
    // Graduated first, then by progress; idle pools (nothing raised) last.
    s.pools.sort(
      (a, b) =>
        Number(b.migrated) - Number(a.migrated) ||
        b.progress - a.progress ||
        b.raisedQuote - a.raisedQuote,
    );
  }
  const totals = stocks.reduce(
    (acc, s) => {
      acc.pools += s.pools.length;
      acc.live += s.live;
      acc.graduated += s.graduated;
      acc.raisedUsd += s.raisedUsd;
      acc.feesUsd += s.feesUsd;
      return acc;
    },
    {
      hidden,
      stocksUsed: stocks.length,
      configs: configs.length,
      pools: 0,
      live: 0,
      graduated: 0,
      raisedUsd: 0,
      feesUsd: 0,
    },
  );
  const scanned = getMeta("curves_scanned_at");
  const scannedAt = scanned ? Number(scanned) : null;
  return {
    stocks,
    totals,
    scannedAt,
    scannedAgoMs: scannedAt ? Date.now() - scannedAt : null,
  };
}

/** One stock, by its Wall Street ticker, with every pool quoted in it. */
export async function curvesForStock(
  underlying: string,
): Promise<CurveStock | null> {
  const data = await curvesOverview();
  return (
    data.stocks.find(
      (s) => s.underlying.toUpperCase() === underlying.toUpperCase(),
    ) ?? null
  );
}
