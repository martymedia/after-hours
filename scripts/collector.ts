// Background collector. Runs forever:
//   every 60 s   price snapshot for every tracked token (Jupiter price v3)
//   every 6 h    rebuild the universe (new listings, liquidity changes)
//   hourly       top up hourly candles from GeckoTerminal (backfill 7 days once)
//
// Run with: node scripts/collector.ts   (Node 24, no build step)

import {
  deactivateTokensExcept,
  getMeta,
  insertSnapshots,
  latestCandleTs,
  latestSnapshots,
  listTokens,
  pruneSnapshots,
  replaceEarnings,
  setMeta,
  upsertCandles,
  upsertTokens,
} from "../src/lib/db.ts";
import { getPrices } from "../src/lib/jupiter.ts";
import { MIN_LIST_LIQUIDITY_USD, buildUniverse } from "../src/lib/universe.ts";
import { hourlyCandles, topPoolFor } from "../src/lib/geckoterminal.ts";
import { fetchEarnings } from "../src/lib/earnings.ts";

const SNAPSHOT_EVERY_MS = 60_000;
const UNIVERSE_EVERY_MS = 6 * 3600_000;
const CANDLES_EVERY_MS = 3600_000;
const KEEP_SNAPSHOTS_MS = 14 * 86400_000;
const EARNINGS_EVERY_MS = 12 * 3600_000;
const GECKO_PACE_MS = 6000; // GeckoTerminal throttles hard; ~10 requests per minute is safe
const GECKO_BACKOFF_MS = 65_000;

const log = (...args: unknown[]) => console.log(new Date().toISOString(), ...args);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function refreshUniverse(): Promise<void> {
  const tokens = await buildUniverse();
  upsertTokens(tokens);
  deactivateTokensExcept(tokens.map((t) => t.mint));
  setMeta("universe_updated_at", String(Date.now()));
  log(`universe: ${tokens.length} tokens`);
}

async function snapshot(): Promise<void> {
  const tokens = listTokens();
  if (tokens.length === 0) return;
  const prices = await getPrices(tokens.map((t) => t.mint));
  const ts = Date.now();
  const rows = tokens.map((t) => {
    const p = prices[t.mint];
    return {
      mint: t.mint,
      ts,
      usd_price: p?.usdPrice ?? null,
      ref_price: p?.stockData?.price ?? null,
      ref_source: p?.stockData?.id ?? null,
      ref_updated_at: p?.stockData?.updatedAt ? Date.parse(p.stockData.updatedAt) : null,
      liquidity: p?.liquidity ?? null,
      block_id: p?.blockId ?? null,
    };
  });
  insertSnapshots(rows);
  log(`snapshot: ${rows.filter((r) => r.usd_price != null).length}/${rows.length} priced`);
}

async function refreshCandles(): Promise<void> {
  // Only tokens with a real pool; the rest have no candles anyway.
  const liquid = new Set(
    latestSnapshots()
      .filter((s) => (s.liquidity ?? 0) >= MIN_LIST_LIQUIDITY_USD)
      .map((s) => s.mint),
  );
  const tokens = listTokens().filter((t) => liquid.has(t.mint));
  let calls = 0;
  for (const t of tokens) {
    try {
      const pool = getMeta(`pool:${t.mint}`) ?? (await topPoolFor(t.mint));
      if (!pool) continue;
      if (!getMeta(`pool:${t.mint}`)) {
        setMeta(`pool:${t.mint}`, pool);
        calls++;
        await sleep(GECKO_PACE_MS);
      }
      const latest = latestCandleTs(t.mint);
      const limit = latest ? 6 : 168;
      const candles = await hourlyCandles(pool, limit);
      calls++;
      upsertCandles(candles.map((c) => ({ mint: t.mint, ...c })));
      await sleep(GECKO_PACE_MS);
    } catch (err) {
      const msg = (err as Error).message;
      log(`candles ${t.symbol}: ${msg}`);
      await sleep(msg.includes("429") ? GECKO_BACKOFF_MS : GECKO_PACE_MS * 2);
    }
  }
  log(`candles: refreshed ${tokens.length} tokens with ${calls} calls`);
}

async function refreshEarnings(): Promise<void> {
  const symbols = new Set(listTokens().map((t) => t.underlying));
  const events = await fetchEarnings(symbols, 60);
  replaceEarnings(events);
  setMeta("earnings_updated_at", String(Date.now()));
  log(`earnings: ${events.length} upcoming in the universe`);
}

async function main(): Promise<void> {
  const universeAge = Date.now() - Number(getMeta("universe_updated_at") ?? 0);
  if (listTokens().length === 0 || universeAge > UNIVERSE_EVERY_MS) {
    await refreshUniverse();
  }

  let lastUniverse = Date.now();
  let lastCandles = 0;

  // Candle backfill runs alongside the snapshot loop so snapshots start now.
  const candleLoop = async () => {
    for (;;) {
      const earningsAge = Date.now() - Number(getMeta("earnings_updated_at") ?? 0);
      if (earningsAge >= EARNINGS_EVERY_MS) {
        await refreshEarnings().catch((err) => log("earnings failed:", err.message));
      }
      if (Date.now() - lastCandles >= CANDLES_EVERY_MS) {
        lastCandles = Date.now();
        await refreshCandles().catch((err) => log("candles failed:", err.message));
      }
      await sleep(30_000);
    }
  };
  void candleLoop();

  for (;;) {
    const started = Date.now();
    try {
      if (Date.now() - lastUniverse >= UNIVERSE_EVERY_MS) {
        lastUniverse = Date.now();
        await refreshUniverse();
      }
      await snapshot();
      pruneSnapshots(Date.now() - KEEP_SNAPSHOTS_MS);
    } catch (err) {
      log("snapshot failed:", (err as Error).message);
    }
    await sleep(Math.max(1000, SNAPSHOT_EVERY_MS - (Date.now() - started)));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
