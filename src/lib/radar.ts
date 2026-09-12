// Assembles what the home page shows: one row per real-world stock, using
// the most liquid token for that stock, plus the market phase.

import { candlesSince, latestSnapshots, listTokens, sparkSeries, type SnapshotRow, type TokenRow } from "./db.ts";
import { ISSUERS, type IssuerId } from "./issuers.ts";
import { getPhase, hasLiveReference, referenceLabel } from "./market-phase.ts";
import { MIN_LIQUIDITY_USD } from "./universe.ts";
import type { RadarData, RadarRow, Tradability } from "./radar-types.ts";

export type { RadarData, RadarRow, Tradability } from "./radar-types.ts";
export { TRADABILITY_LABEL } from "./radar-types.ts";

const SLOT_MS = 400; // approximate Solana slot time
const STALE_AFTER_MS = 60 * 60_000;
const EASY_LIQUIDITY_USD = 500_000;

export function tradabilityOf(liquidity: number, ageMs: number | null, price: number | null): Tradability {
  if (price == null || liquidity < MIN_LIQUIDITY_USD) return "none";
  if (ageMs != null && ageMs > STALE_AFTER_MS) return "stale";
  if (liquidity >= EASY_LIQUIDITY_USD) return "easy";
  return "ok";
}

export function ageOf(snap: SnapshotRow | undefined, maxBlock: number, now: number): number | null {
  if (!snap) return null;
  const slotAge = snap.block_id != null ? (maxBlock - snap.block_id) * SLOT_MS : 0;
  return Math.max(0, now - snap.ts + slotAge);
}

export function getRadar(): RadarData {
  const now = Date.now();
  const phase = getPhase(new Date(now));
  const tokens = listTokens();
  const snaps = new Map(latestSnapshots().map((s) => [s.mint, s]));
  const maxBlock = Math.max(0, ...[...snaps.values()].map((s) => s.block_id ?? 0));

  // Pick the most liquid token per stock.
  const byUnderlying = new Map<string, { token: TokenRow; snap: SnapshotRow | undefined; count: number }>();
  for (const t of tokens) {
    const snap = snaps.get(t.mint);
    const liq = snap?.liquidity ?? 0;
    const current = byUnderlying.get(t.underlying);
    if (!current) {
      byUnderlying.set(t.underlying, { token: t, snap, count: 1 });
      continue;
    }
    current.count++;
    if (liq > (current.snap?.liquidity ?? 0)) {
      current.token = t;
      current.snap = snap;
    }
  }

  const sparks = sparkSeries(now - 48 * 3600_000, 30 * 60_000);

  const rows: RadarRow[] = [];
  for (const { token, snap, count } of byUnderlying.values()) {
    const liquidity = snap?.liquidity ?? 0;
    if (liquidity < MIN_LIQUIDITY_USD) continue;
    const price = snap?.usd_price ?? null;
    const reference = snap?.ref_price ?? null;
    const ageMs = ageOf(snap, maxBlock, now);
    let spark = sparks.get(token.mint) ?? [];
    if (spark.length < 8) {
      spark = candlesSince(token.mint, now - 48 * 3600_000).map((c) => c.close);
    }
    rows.push({
      underlying: token.underlying,
      name: token.name,
      mint: token.mint,
      symbol: token.symbol,
      issuer: token.issuer as IssuerId,
      issuerName: ISSUERS[token.issuer as IssuerId]?.name ?? token.issuer,
      price,
      reference,
      gapPct: price != null && reference ? (price / reference - 1) * 100 : null,
      ageMs,
      liquidity,
      tradability: tradabilityOf(liquidity, ageMs, price),
      issuerCount: count,
      spark,
    });
  }

  rows.sort((a, b) => b.liquidity - a.liquidity);

  return {
    generatedAt: new Date(now).toISOString(),
    phase,
    liveReference: hasLiveReference(phase.phase),
    reference: referenceLabel(phase.phase, new Date(now)),
    rows,
  };
}
