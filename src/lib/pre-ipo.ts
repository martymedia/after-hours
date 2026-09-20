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
} from "./db.ts";
import { ISSUERS, type IssuerId } from "./issuers.ts";
import { getPrices, getQuote, USDC_MINT } from "./jupiter.ts";
import { ageOf, tradabilityOf } from "./radar.ts";
import type { Tradability } from "./radar-types.ts";
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
  /** The whole company, at the mark and at what the market pays. */
  markValuation: number | null;
  marketValuation: number | null;
  change24hPct: number | null;
  ageMs: number | null;
  liquidity: number;
  tradability: Tradability;
  /** What a small buy really costs in price impact, at TEST_USD. */
  impactPct: number | null;
  /** The premium itself over the last two days, for the card's picture. */
  premiumSpark: number[];
  /** From the issuer: what the company does, and what the token is. */
  about: string | null;
  tokenNote: string | null;
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
    // Keep whatever we had; the pages work without the blurbs.
    return aboutCache?.byMint ?? new Map();
  }
}

type Extra = { impactPct: number | null; change24hPct: number | null };
const EXTRA_TTL_MS = 5 * 60_000;
let extraCache: { ts: number; byMint: Map<string, Extra> } | null = null;

/**
 * Pool size flatters these markets: a token can show 280k in pools and still
 * cost 3% to buy 25 dollars of, because the liquidity sits in an order book
 * nobody is quoting tightly. So we ask for a real route, per company.
 */
async function extrasByMint(mints: string[]): Promise<Map<string, Extra>> {
  if (extraCache && Date.now() - extraCache.ts < EXTRA_TTL_MS)
    return extraCache.byMint;
  const byMint = new Map<string, Extra>();
  const prices = await getPrices(mints).catch(
    () => ({}) as Awaited<ReturnType<typeof getPrices>>,
  );
  await Promise.all(
    mints.map(async (mint) => {
      let impactPct: number | null = null;
      try {
        const q = await getQuote({
          inputMint: USDC_MINT,
          outputMint: mint,
          amount: BigInt(TEST_USD * 1_000_000),
        });
        if (q) impactPct = Number(q.priceImpactPct) * 100;
      } catch {
        // No route right now: the card simply omits the number.
      }
      byMint.set(mint, {
        impactPct,
        change24hPct: prices[mint]?.priceChange24h ?? null,
      });
    }),
  );
  // An empty batch means the lookups failed, not that trading is free.
  if ([...byMint.values()].some((e) => e.impactPct != null))
    extraCache = { ts: Date.now(), byMint };
  return byMint;
}

/** The premium over a window, in fixed steps. */
function premiumSeries(
  mint: string,
  since: number,
  bucketMs: number,
): { ts: number; premiumPct: number }[] {
  const buckets = new Map<number, { sum: number; n: number }>();
  for (const s of snapshotsSince(mint, since)) {
    if (s.usd_price == null || !s.ref_price) continue;
    const b = Math.floor(s.ts / bucketMs) * bucketMs;
    const cur = buckets.get(b) ?? { sum: 0, n: 0 };
    cur.sum += (s.usd_price / s.ref_price - 1) * 100;
    cur.n++;
    buckets.set(b, cur);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ts, v]) => ({ ts, premiumPct: v.sum / v.n }));
}

export async function getPreIpo(): Promise<PreIpoData> {
  const now = Date.now();
  const tokens = listPreIpoTokens();
  const snaps = new Map(latestSnapshots().map((s) => [s.mint, s]));
  const maxBlock = Math.max(
    0,
    ...[...snaps.values()].map((s) => s.block_id ?? 0),
  );
  const [about, extras] = await Promise.all([
    aboutByMint(),
    extrasByMint(tokens.map((t) => t.mint)),
  ]);

  const rows: PreIpoRow[] = tokens.map((t) => {
    const snap = snaps.get(t.mint);
    const price = snap?.usd_price ?? null;
    const mark = snap?.ref_price ?? null;
    const liquidity = snap?.liquidity ?? 0;
    const ageMs = ageOf(snap, maxBlock, now);
    const premiumPct = price != null && mark ? (price / mark - 1) * 100 : null;
    const info = about.get(t.mint);
    // Their blurb is the company, a blank line, then what the token is.
    const [company, tokenNote] = (info?.description ?? "").split("\n\n");
    const markValuation = info?.markValuation ?? null;
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
      premiumPct,
      markValuation,
      // The whole company at what the market pays, from our own price rather
      // than the issuer's, so it always matches the premium next to it.
      marketValuation:
        markValuation != null && premiumPct != null
          ? markValuation * (1 + premiumPct / 100)
          : null,
      change24hPct: extras.get(t.mint)?.change24hPct ?? null,
      ageMs,
      liquidity,
      tradability: tradabilityOf(liquidity, ageMs, price),
      impactPct: extras.get(t.mint)?.impactPct ?? null,
      premiumSpark: premiumSeries(t.mint, now - 48 * 3600_000, 30 * 60_000).map(
        (p) => p.premiumPct,
      ),
      about: company?.trim() || null,
      tokenNote: tokenNote?.trim() || null,
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

export type PreIpoOther = {
  underlying: string;
  name: string;
  symbol: string;
  logo: string | null;
  premiumPct: number | null;
};

export type PreIpoCompany = PreIpoRow & {
  /** When this view was built, so pages need no clock of their own. */
  generatedAt: string;
  /** Onchain price over the last week, for the chart. */
  candles: { ts: number; close: number }[];
  /** Premium against the mark over the last two days, bucketed. */
  premiumHistory: { ts: number; premiumPct: number }[];
  structure: string;
  issuerUrl: string;
  /** The other companies, for moving on without going back. */
  others: PreIpoOther[];
};

export async function getPreIpoCompany(
  underlying: string,
): Promise<PreIpoCompany | null> {
  const data = await getPreIpo();
  const row = data.rows.find(
    (r) => r.underlying.toUpperCase() === underlying.toUpperCase(),
  );
  if (!row) return null;
  const now = Date.parse(data.generatedAt);
  const candles = candlesSince(row.mint, now - 7 * 86400_000).map((c) => ({
    ts: c.ts,
    close: c.close,
  }));
  const issuer = ISSUERS[row.issuer];
  return {
    ...row,
    generatedAt: data.generatedAt,
    candles,
    // Fifteen-minute buckets, the same shape the gap chart uses for stocks.
    premiumHistory: premiumSeries(row.mint, now - 48 * 3600_000, 15 * 60_000),
    structure: issuer?.structure ?? "",
    issuerUrl: issuer?.url ?? "",
    others: data.rows
      .filter((r) => r.underlying !== row.underlying)
      .map((r) => ({
        underlying: r.underlying,
        name: r.name,
        symbol: r.symbol,
        logo: r.logo,
        premiumPct: r.premiumPct,
      })),
  };
}
