// Meteora Dynamic Bonding Curve, read-only: which launch pools use one of
// our tokenized stocks as the quote token, and how far along each is. Runs
// in the collector; the web app reads the tables this fills.
//
// Discovery: a pool config stores its quote mint at byte offset 8, a pool
// stores its config at offset 72, so two filtered getProgramAccounts calls
// per stock and config find everything without walking the whole program.

import { Connection, PublicKey } from "@solana/web3.js";
import {
  DynamicBondingCurveClient,
  createProgramAccountFilter,
  getPriceFromSqrtPrice,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import type { BN } from "@coral-xyz/anchor";
import { SITE_URL } from "./brand.ts";
import {
  configsByAddress,
  livePools,
  poolsWithoutMetadata,
  setPoolMetadata,
  upsertConfigs,
  upsertPools,
  type PoolState,
} from "./dbc-db.ts";

const RPC_URL =
  process.env.SOLANA_RPC_SERVER_URL ??
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
  "https://api.mainnet-beta.solana.com";
const PACE_MS = 300; // Helius answers 429 above a few calls a second on getProgramAccounts

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const dec = (v: BN | number | null | undefined): string =>
  v == null ? "0" : typeof v === "number" ? String(v) : v.toString(10);
const num = (v: BN | number | null | undefined): number =>
  v == null ? 0 : typeof v === "number" ? v : Number(v.toString(10));

let client: DynamicBondingCurveClient | null = null;
function dbc(): DynamicBondingCurveClient {
  if (client) return client;
  const connection = new Connection(RPC_URL, {
    commitment: "confirmed",
    httpHeaders: RPC_URL.includes("helius") ? { Origin: SITE_URL } : undefined,
  });
  client = new DynamicBondingCurveClient(connection, "confirmed");
  return client;
}

type RawPool = {
  config: PublicKey;
  creator: PublicKey;
  baseMint: PublicKey;
  quoteReserve: BN;
  sqrtPrice: BN;
  activationPoint: BN;
  finishCurveTimestamp: BN;
  isMigrated: number;
  metrics: { totalTradingQuoteFee: BN };
};

function poolState(
  pool: string,
  raw: RawPool,
  cfg: { quote_mint: string; token_decimal: number; threshold: string },
  quoteDecimals: number,
): PoolState {
  const threshold = Number(cfg.threshold);
  const reserve = num(raw.quoteReserve);
  let price: number | null = null;
  try {
    price = Number(
      getPriceFromSqrtPrice(
        raw.sqrtPrice,
        cfg.token_decimal,
        quoteDecimals,
      ).toString(),
    );
    if (!Number.isFinite(price)) price = null;
  } catch {
    price = null;
  }
  return {
    pool,
    config: raw.config.toBase58(),
    quote_mint: cfg.quote_mint,
    base_mint: raw.baseMint.toBase58(),
    creator: raw.creator.toBase58(),
    quote_reserve: dec(raw.quoteReserve),
    sqrt_price: dec(raw.sqrtPrice),
    is_migrated: raw.isMigrated ? 1 : 0,
    activation_point: num(raw.activationPoint) || null,
    finish_ts: num(raw.finishCurveTimestamp) || null,
    trading_quote_fee: dec(raw.metrics?.totalTradingQuoteFee),
    price_quote: price,
    progress: threshold > 0 ? Math.min(1, reserve / threshold) : 0,
  };
}

/**
 * Full scan: every config quoted in one of the stocks, then every pool of
 * those configs. About two calls per config; paced to stay under the RPC's
 * rate limit. Returns counts for the log.
 */
export async function scanCurves(
  stocks: { mint: string; decimals: number }[],
  log: (msg: string) => void = () => {},
): Promise<{ configs: number; pools: number }> {
  const c = dbc();
  const program = c.state.getProgram();
  const decimalsOf = new Map(stocks.map((s) => [s.mint, s.decimals]));
  const configRows: Parameters<typeof upsertConfigs>[0] = [];

  for (const s of stocks) {
    try {
      const found = await program.account.poolConfig.all(
        createProgramAccountFilter(new PublicKey(s.mint), 8),
      );
      for (const f of found) {
        const a = f.account;
        configRows.push({
          config: f.publicKey.toBase58(),
          quote_mint: s.mint,
          fee_claimer: a.feeClaimer.toBase58(),
          token_decimal: a.tokenDecimal,
          threshold: dec(a.migrationQuoteThreshold),
          sqrt_start_price: dec(a.sqrtStartPrice),
          migration_option: a.migrationOption,
        });
      }
    } catch (err) {
      log(
        `curves: configs for ${s.mint.slice(0, 6)} failed: ${(err as Error).message.slice(0, 80)}`,
      );
    }
    await sleep(PACE_MS);
  }
  upsertConfigs(configRows);

  let pools = 0;
  for (const cfg of configRows) {
    try {
      const found = await c.state.getPoolsByConfig(cfg.config);
      const rows: PoolState[] = [];
      for (const f of found) {
        const raw = ((f.account as { poolState?: RawPool }).poolState ??
          (f.account as unknown as RawPool)) as RawPool;
        rows.push(
          poolState(
            f.publicKey.toBase58(),
            raw,
            cfg,
            decimalsOf.get(cfg.quote_mint) ?? 8,
          ),
        );
      }
      if (rows.length) upsertPools(rows);
      pools += rows.length;
    } catch (err) {
      log(
        `curves: pools for ${cfg.config.slice(0, 6)} failed: ${(err as Error).message.slice(0, 80)}`,
      );
    }
    await sleep(PACE_MS);
  }
  return { configs: configRows.length, pools };
}

/** Refresh the live pools (not graduated, some progress) in batches of 100 accounts. */
export async function refreshLiveCurves(
  stocks: { mint: string; decimals: number }[],
): Promise<number> {
  const c = dbc();
  const program = c.state.getProgram();
  const decimalsOf = new Map(stocks.map((s) => [s.mint, s.decimals]));
  const configs = configsByAddress();
  const live = livePools();
  let updated = 0;
  for (let i = 0; i < live.length; i += 100) {
    const batch = live.slice(i, i + 100);
    const infos = await program.provider.connection.getMultipleAccountsInfo(
      batch.map((p) => new PublicKey(p.pool)),
    );
    const rows: PoolState[] = [];
    infos.forEach((info, j) => {
      const row = batch[j];
      const cfg = configs.get(row.config);
      if (!info || !cfg) return;
      try {
        const decoded = program.coder.accounts.decode(
          "virtualPool",
          info.data,
        ) as { poolState?: RawPool };
        const raw = (decoded.poolState ??
          (decoded as unknown as RawPool)) as RawPool;
        rows.push(
          poolState(row.pool, raw, cfg, decimalsOf.get(cfg.quote_mint) ?? 8),
        );
      } catch {
        // account shape changed or transfer-hook variant; the full scan catches it
      }
    });
    if (rows.length) upsertPools(rows);
    updated += rows.length;
    await sleep(PACE_MS);
  }
  return updated;
}

/** Names, symbols and images of launched tokens, via the RPC's DAS getAsset (Helius). */
export async function fillCurveMetadata(limit = 60): Promise<number> {
  const todo = poolsWithoutMetadata(limit);
  let done = 0;
  for (const p of todo) {
    try {
      const res = await fetch(RPC_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(RPC_URL.includes("helius") ? { Origin: SITE_URL } : {}),
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getAsset",
          params: { id: p.base_mint },
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const body = (await res.json()) as {
        result?: {
          content?: {
            metadata?: { name?: string; symbol?: string };
            links?: { image?: string };
          };
        };
      };
      const m = body.result?.content;
      setPoolMetadata(p.pool, {
        name: m?.metadata?.name?.trim() || "(unnamed)",
        symbol: m?.metadata?.symbol?.trim() || null,
        image: m?.links?.image || null,
      });
      done++;
    } catch {
      // try again next round
    }
    await sleep(PACE_MS);
  }
  return done;
}
