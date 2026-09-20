// Private companies, tokenized by PreStocks. There is no exchange price to
// compare against, so the reference is the issuer's own mark: the value
// they carry the SPV at. The distance between the onchain price and that
// mark is the premium, and it is the only number on these pages that is
// ours to compute.

import {
  candlesSince,
  latestSnapshots,
  listPreIpoTokens,
  snapshotsSince,
  sparkSeries,
} from "./db.ts";
import { ISSUERS, type IssuerId } from "./issuers.ts";
import { ageOf, tradabilityOf } from "./radar.ts";
import type { Tradability } from "./radar-types.ts";
import { getQuote, USDC_MINT } from "./jupiter.ts";
import { fetchPreStocks, type PreStocksAsset } from "./universe.ts";

export type PreIpoRow = {
  /** Our route key and the issuer's symbol: the company, not a ticker. */
  underlying: string;
  symbol: string;
  name: string;
  mint: string;
  logo: string | null;
  issuer: IssuerId;
  issuerName: string;
  /** What the issuer says the company is worth, per token. */
  mark: number | null;
  price: number | null;
  /** Onchain price over the mark, in percent. */
  premiumPct: number | null;
  ageMs: number | null;
  liquidity: number;
  tradability: Tradability;
  spark: number[];
  /** What a small buy really costs in price impact, at TEST_USD. */
  impactPct: number | null;
  /** From the issuer: what the company does, and what the token is. */
  about: string | null;
  issuerPage: string | null;
};

export type PreIpoData = {
  generatedAt: string;
  rows: PreIpoRow[];
  totals: {
    companies: number;
    liquidity: number;
    /** How many trade above their mark right now. */
    above: number;
    below: number;
  };
};

/** A buy small enough that its cost is the market's, not the buyer's. */
export const TEST_USD = 25;
const IMPACT_TTL_MS = 5 * 60_000;
let impactCache: { ts: number; byMint: Map<string, number> } | null = null;

/**
 * Pool size alone flatters these markets: a token can show 280k in pools and
 * still cost 3% to buy 25 dollars of, because the liquidity sits in an order
 * book nobody is quoting tightly. So we ask for a real quote per company.
 */
async function impactByMint(mints: string[]): Promise<Map<string, number>> {
  if (impactCache && Date.now() - impactCache.ts < IMPACT_TTL_MS)
    return impactCache.byMint;
  const byMint = new Map<string, number>();
  await Promise.all(
    mints.map(async (mint) => {
      try {
        const q = await getQuote({
          inputMint: USDC_MINT,
          outputMint: mint,
          amount: BigInt(TEST_USD * 1_000_000),
        });
        if (q) byMint.set(mint, Number(q.priceImpactPct) * 100);
      } catch {
        // No route right now: the card simply omits the number.
      }
    }),
  );
  // An empty batch means the route lookups failed, not that trading is
  // free: keep no cache so the next render tries again.
  if (byMint.size > 0) impactCache = { ts: Date.now(), byMint };
  return byMint;
}

// The issuer's blurbs change rarely and their API is not ours to hammer.
const ABOUT_TTL_MS = 30 * 60_000;
let aboutCache: { ts: number; byMint: Map<string, PreStocksAsset> } | null =
  null;

async function aboutByMint(): Promise<Map<string, PreStocksAsset>> {
  if (aboutCache && Date.now() - aboutCache.ts < ABOUT_TTL_MS)
    return aboutCache.byMint;
  try {
    const assets = await fetchPreStocks();
    const byMint = new Map(assets.map((a) => [a.contract_address, a]));
    aboutCache = { ts: Date.now(), byMint };
    return byMint;
  } catch {
    // Keep whatever we had; the page works without the blurbs.
    return aboutCache?.byMint ?? new Map();
  }
}

export async function getPreIpo(): Promise<PreIpoData> {
  const now = Date.now();
  const tokens = listPreIpoTokens();
  const snaps = new Map(latestSnapshots().map((s) => [s.mint, s]));
  const maxBlock = Math.max(
    0,
    ...[...snaps.values()].map((s) => s.block_id ?? 0),
  );
  const sparks = sparkSeries(now - 48 * 3600_000, 30 * 60_000);
  const [about, impact] = await Promise.all([
    aboutByMint(),
    impactByMint(tokens.map((t) => t.mint)),
  ]);

  const rows: PreIpoRow[] = tokens.map((t) => {
    const snap = snaps.get(t.mint);
    const price = snap?.usd_price ?? null;
    const mark = snap?.ref_price ?? null;
    const liquidity = snap?.liquidity ?? 0;
    const ageMs = ageOf(snap, maxBlock, now);
    let spark = sparks.get(t.mint) ?? [];
    if (spark.length < 8) {
      spark = candlesSince(t.mint, now - 48 * 3600_000).map((c) => c.close);
    }
    const info = about.get(t.mint);
    return {
      underlying: t.underlying,
      symbol: t.symbol,
      name: t.name,
      mint: t.mint,
      logo: t.logo ?? null,
      issuer: t.issuer as IssuerId,
      issuerName: ISSUERS[t.issuer as IssuerId]?.name ?? t.issuer,
      mark,
      price,
      premiumPct: price != null && mark ? (price / mark - 1) * 100 : null,
      ageMs,
      liquidity,
      tradability: tradabilityOf(liquidity, ageMs, price),
      spark,
      impactPct: impact.get(t.mint) ?? null,
      about: info?.description ?? null,
      issuerPage: info?.external_url ?? null,
    };
  });

  // The furthest from the mark first: that is what there is to look at.
  rows.sort(
    (a, b) => Math.abs(b.premiumPct ?? 0) - Math.abs(a.premiumPct ?? 0),
  );
  return {
    generatedAt: new Date(now).toISOString(),
    rows,
    totals: {
      companies: rows.length,
      liquidity: rows.reduce((sum, r) => sum + r.liquidity, 0),
      above: rows.filter((r) => (r.premiumPct ?? 0) > 0.25).length,
      below: rows.filter((r) => (r.premiumPct ?? 0) < -0.25).length,
    },
  };
}

export type PreIpoCompany = PreIpoRow & {
  /** When this view was built, so pages need no clock of their own. */
  generatedAt: string;
  /** Onchain price over the last week, for the chart. */
  candles: { ts: number; close: number }[];
  /** Premium against the mark over the last two days, bucketed. */
  premiumSeries: { ts: number; premiumPct: number }[];
  structure: string;
  issuerUrl: string;
};

export async function getPreIpoCompany(
  underlying: string,
): Promise<PreIpoCompany | null> {
  const data = await getPreIpo();
  const row = data.rows.find(
    (r) => r.underlying.toUpperCase() === underlying.toUpperCase(),
  );
  if (!row) return null;
  const now = Date.now();
  const candles = candlesSince(row.mint, now - 7 * 86400_000).map((c) => ({
    ts: c.ts,
    close: c.close,
  }));
  // Fifteen-minute buckets, the same shape the gap chart uses for stocks.
  const bucket = 15 * 60_000;
  const buckets = new Map<number, { sum: number; n: number }>();
  for (const s of snapshotsSince(row.mint, now - 48 * 3600_000)) {
    if (s.usd_price == null || !s.ref_price) continue;
    const b = Math.floor(s.ts / bucket) * bucket;
    const cur = buckets.get(b) ?? { sum: 0, n: 0 };
    cur.sum += (s.usd_price / s.ref_price - 1) * 100;
    cur.n++;
    buckets.set(b, cur);
  }
  const premiumSeries = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ts, v]) => ({ ts, premiumPct: v.sum / v.n }));
  const issuer = ISSUERS[row.issuer];
  return {
    ...row,
    generatedAt: data.generatedAt,
    candles,
    premiumSeries,
    structure: issuer?.structure ?? "",
    issuerUrl: issuer?.url ?? "",
  };
}
