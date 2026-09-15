// Meteora Dynamic Bonding Curve pools whose quote token is one of our
// tokenized stocks. Written by the collector's curve scan, read by /curves.
// Raw u64/u128 values are stored as decimal strings; the page converts.

import { getDb } from "./db.ts";

let ready = false;
function db() {
  const d = getDb();
  if (!ready) {
    d.exec(`
      CREATE TABLE IF NOT EXISTS dbc_configs (
        config            TEXT PRIMARY KEY,
        quote_mint        TEXT NOT NULL,
        fee_claimer       TEXT NOT NULL,
        token_decimal     INTEGER NOT NULL,
        threshold         TEXT NOT NULL,
        sqrt_start_price  TEXT NOT NULL,
        migration_option  INTEGER NOT NULL,
        first_seen        INTEGER NOT NULL,
        last_seen         INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS dbc_configs_quote ON dbc_configs(quote_mint);

      CREATE TABLE IF NOT EXISTS dbc_pools (
        pool               TEXT PRIMARY KEY,
        config             TEXT NOT NULL,
        quote_mint         TEXT NOT NULL,
        base_mint          TEXT NOT NULL,
        creator            TEXT NOT NULL,
        name               TEXT,
        symbol             TEXT,
        image              TEXT,
        quote_reserve      TEXT NOT NULL,
        sqrt_price         TEXT NOT NULL,
        is_migrated        INTEGER NOT NULL,
        activation_point   INTEGER,
        finish_ts          INTEGER,
        trading_quote_fee  TEXT NOT NULL,
        price_quote        REAL,
        progress           REAL NOT NULL,
        first_seen         INTEGER NOT NULL,
        updated_at         INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS dbc_pools_quote ON dbc_pools(quote_mint);
      CREATE INDEX IF NOT EXISTS dbc_pools_config ON dbc_pools(config);
    `);
    ready = true;
  }
  return d;
}

export type DbcConfigRow = {
  config: string;
  quote_mint: string;
  fee_claimer: string;
  token_decimal: number;
  threshold: string;
  sqrt_start_price: string;
  migration_option: number;
  first_seen: number;
  last_seen: number;
};

export type DbcPoolRow = {
  pool: string;
  config: string;
  quote_mint: string;
  base_mint: string;
  creator: string;
  name: string | null;
  symbol: string | null;
  image: string | null;
  quote_reserve: string;
  sqrt_price: string;
  is_migrated: number;
  activation_point: number | null;
  finish_ts: number | null;
  trading_quote_fee: string;
  price_quote: number | null;
  progress: number;
  first_seen: number;
  updated_at: number;
};

export function upsertConfigs(
  rows: Omit<DbcConfigRow, "first_seen" | "last_seen">[],
): void {
  const d = db();
  const now = Date.now();
  const stmt = d.prepare(`
    INSERT INTO dbc_configs (config, quote_mint, fee_claimer, token_decimal, threshold, sqrt_start_price, migration_option, first_seen, last_seen)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(config) DO UPDATE SET
      quote_mint = excluded.quote_mint, fee_claimer = excluded.fee_claimer, token_decimal = excluded.token_decimal,
      threshold = excluded.threshold, sqrt_start_price = excluded.sqrt_start_price, migration_option = excluded.migration_option,
      last_seen = excluded.last_seen
  `);
  d.exec("BEGIN");
  try {
    for (const r of rows)
      stmt.run(
        r.config,
        r.quote_mint,
        r.fee_claimer,
        r.token_decimal,
        r.threshold,
        r.sqrt_start_price,
        r.migration_option,
        now,
        now,
      );
    d.exec("COMMIT");
  } catch (err) {
    d.exec("ROLLBACK");
    throw err;
  }
}

export type PoolState = Pick<
  DbcPoolRow,
  | "pool"
  | "config"
  | "quote_mint"
  | "base_mint"
  | "creator"
  | "quote_reserve"
  | "sqrt_price"
  | "is_migrated"
  | "activation_point"
  | "finish_ts"
  | "trading_quote_fee"
  | "price_quote"
  | "progress"
>;

/** Insert new pools or refresh the live fields of known ones (metadata is kept). */
export function upsertPools(rows: PoolState[]): void {
  const d = db();
  const now = Date.now();
  const stmt = d.prepare(`
    INSERT INTO dbc_pools (pool, config, quote_mint, base_mint, creator, quote_reserve, sqrt_price, is_migrated, activation_point, finish_ts, trading_quote_fee, price_quote, progress, first_seen, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(pool) DO UPDATE SET
      quote_reserve = excluded.quote_reserve, sqrt_price = excluded.sqrt_price, is_migrated = excluded.is_migrated,
      activation_point = excluded.activation_point, finish_ts = excluded.finish_ts, trading_quote_fee = excluded.trading_quote_fee,
      price_quote = excluded.price_quote, progress = excluded.progress, updated_at = excluded.updated_at
  `);
  d.exec("BEGIN");
  try {
    for (const r of rows) {
      stmt.run(
        r.pool,
        r.config,
        r.quote_mint,
        r.base_mint,
        r.creator,
        r.quote_reserve,
        r.sqrt_price,
        r.is_migrated,
        r.activation_point,
        r.finish_ts,
        r.trading_quote_fee,
        r.price_quote,
        r.progress,
        now,
        now,
      );
    }
    d.exec("COMMIT");
  } catch (err) {
    d.exec("ROLLBACK");
    throw err;
  }
}

export function setPoolMetadata(
  pool: string,
  meta: { name: string | null; symbol: string | null; image: string | null },
): void {
  db()
    .prepare(
      "UPDATE dbc_pools SET name = ?, symbol = ?, image = ? WHERE pool = ?",
    )
    .run(meta.name, meta.symbol, meta.image, pool);
}

/** Pools that still need a name (metadata is fetched once per base mint). */
export function poolsWithoutMetadata(
  limit = 60,
): { pool: string; base_mint: string }[] {
  return db()
    .prepare(
      "SELECT pool, base_mint FROM dbc_pools WHERE name IS NULL ORDER BY first_seen DESC LIMIT ?",
    )
    .all(limit) as { pool: string; base_mint: string }[];
}

/** Pools worth refreshing between full scans: not graduated and with some progress. */
export function livePools(): DbcPoolRow[] {
  return db()
    .prepare(
      "SELECT * FROM dbc_pools WHERE is_migrated = 0 AND progress > 0 ORDER BY progress DESC",
    )
    .all() as DbcPoolRow[];
}

export function listConfigs(): DbcConfigRow[] {
  return db().prepare("SELECT * FROM dbc_configs").all() as DbcConfigRow[];
}

export function listPools(): DbcPoolRow[] {
  return db()
    .prepare(
      "SELECT * FROM dbc_pools ORDER BY is_migrated ASC, progress DESC, first_seen DESC",
    )
    .all() as DbcPoolRow[];
}

/** Every pool a wallet created, newest first. */
export function poolsByCreator(creator: string): DbcPoolRow[] {
  return db()
    .prepare(
      "SELECT * FROM dbc_pools WHERE creator = ? ORDER BY first_seen DESC LIMIT 50",
    )
    .all(creator) as DbcPoolRow[];
}

export function configsByAddress(): Map<string, DbcConfigRow> {
  return new Map(listConfigs().map((c) => [c.config, c]));
}
