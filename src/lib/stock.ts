// Data for the stock detail page: every issuer's token for one stock, the
// price history of the most liquid one, and the market phase.

import { candlesSince, getDb, latestSnapshots, type TokenRow } from "./db.ts";
import { ISSUERS, type IssuerId } from "./issuers.ts";
import { getPhase, hasLiveReference, referenceLabel } from "./market-phase.ts";
import { ageOf, tradabilityOf } from "./radar.ts";
import type { StockData, StockToken } from "./stock-types.ts";

export function getStock(underlying: string): StockData | null {
  const now = Date.now();
  const tokens = getDb()
    .prepare("SELECT * FROM tokens WHERE active = 1 AND underlying = ?")
    .all(underlying.toUpperCase()) as TokenRow[];
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

  const phase = getPhase(new Date(now));
  return {
    generatedAt: new Date(now).toISOString(),
    underlying: underlying.toUpperCase(),
    name: tokens.find((t) => t.mint === primary.mint)?.name ?? underlying,
    phase,
    liveReference: hasLiveReference(phase.phase),
    reference: referenceLabel(phase.phase, new Date(now)),
    primary,
    tokens: list,
    candles,
  };
}
