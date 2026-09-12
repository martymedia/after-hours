// Data for the stock detail page: every issuer's token for one stock, the
// price history of the most liquid one, the gap history, similar stocks and
// the market phase.

import { candlesSince, getDb, latestSnapshots, nextEarningsFor, snapshotsSince, type TokenRow } from "./db.ts";
import { ISSUERS, type IssuerId } from "./issuers.ts";
import { getPhase, hasLiveReference, nyYmd, referenceLabel } from "./market-phase.ts";
import { ageOf, getRadar, tradabilityOf } from "./radar.ts";
import { companyFor } from "./companies.ts";
import type { GapPoint, StockData, StockToken } from "./stock-types.ts";

export function getStock(underlying: string): StockData | null {
  const now = Date.now();
  const key = underlying.toUpperCase();
  const tokens = getDb().prepare("SELECT * FROM tokens WHERE active = 1 AND underlying = ?").all(key) as TokenRow[];
  if (tokens.length === 0) return null;

  const snaps = new Map(latestSnapshots().map((s) => [s.mint, s]));
  const maxBlock = Math.max(0, ...[...snaps.values()].map((s) => s.block_id ?? 0));

  const list: StockToken[] = tokens.map((t) => {
    const snap = snaps.get(t.mint);
    const liquidity = snap?.liquidity ?? 0;
    const price = snap?.usd_price ?? null;
    const reference = snap?.ref_price ?? null;
    const ageMs = ageOf(snap, maxBlock, now);
    const issuer = ISSUERS[t.issuer as IssuerId];
    return {
      mint: t.mint,
      symbol: t.symbol,
      logo: t.logo ?? null,
      issuer: t.issuer as IssuerId,
      issuerName: issuer?.name ?? t.issuer,
      structure: issuer?.structure ?? "",
      structureShort: issuer?.structureShort ?? "",
      decimals: t.decimals,
      price,
      reference,
      gapPct: price != null && reference ? (price / reference - 1) * 100 : null,
      ageMs,
      liquidity,
      tradability: tradabilityOf(liquidity, ageMs, price),
    };
  });
  list.sort((a, b) => b.liquidity - a.liquidity);
  const primary = list[0];

  const candles = candlesSince(primary.mint, now - 7 * 86400_000).map((c) => ({ ts: c.ts, close: c.close }));

  // Gap history from our own snapshots, bucketed to 15 minutes.
  const bucket = 15 * 60_000;
  const gapBuckets = new Map<number, { sum: number; n: number }>();
  for (const s of snapshotsSince(primary.mint, now - 48 * 3600_000)) {
    if (s.usd_price == null || !s.ref_price) continue;
    const b = Math.floor(s.ts / bucket) * bucket;
    const cur = gapBuckets.get(b) ?? { sum: 0, n: 0 };
    cur.sum += (s.usd_price / s.ref_price - 1) * 100;
    cur.n++;
    gapBuckets.set(b, cur);
  }
  const gapSeries: GapPoint[] = [...gapBuckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ts, v]) => ({ ts, gapPct: v.sum / v.n }));

  const company = companyFor(key);
  const similar = getRadar()
    .rows.filter((r) => r.underlying !== key && companyFor(r.underlying).sector === company.sector)
    .slice(0, 6);

  const phase = getPhase(new Date(now));
  return {
    generatedAt: new Date(now).toISOString(),
    underlying: key,
    name: tokens.find((t) => t.mint === primary.mint)?.name ?? underlying,
    description: company.description,
    sector: company.sector,
    phase,
    liveReference: hasLiveReference(phase.phase),
    reference: referenceLabel(phase.phase, new Date(now)),
    primary,
    tokens: list,
    candles,
    gapSeries,
    similar,
    nextEarnings: nextEarningsFor(key, nyYmd(new Date(now))),
  };
}
