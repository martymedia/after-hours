// SQLite via Node's built-in driver. One file, written by the collector,
// read by the web app. No ORM: three tables and a handful of queries.

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DB_PATH = resolve(process.env.AFTER_HOURS_DB ?? "./data/after-hours.db");

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS tokens (
      mint        TEXT PRIMARY KEY,
      symbol      TEXT NOT NULL,
      name        TEXT NOT NULL,
      underlying  TEXT NOT NULL,
      issuer      TEXT NOT NULL,
      decimals    INTEGER NOT NULL,
      active      INTEGER NOT NULL DEFAULT 1,
      updated_at  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS tokens_underlying ON tokens(underlying);

    CREATE TABLE IF NOT EXISTS snapshots (
      mint            TEXT NOT NULL,
      ts              INTEGER NOT NULL,
      usd_price       REAL,
      ref_price       REAL,
      ref_source      TEXT,
      ref_updated_at  INTEGER,
      liquidity       REAL,
      block_id        INTEGER,
      PRIMARY KEY (mint, ts)
    );

    CREATE TABLE IF NOT EXISTS candles (
      mint   TEXT NOT NULL,
      ts     INTEGER NOT NULL,
      open   REAL NOT NULL,
      high   REAL NOT NULL,
      low    REAL NOT NULL,
      close  REAL NOT NULL,
      volume REAL NOT NULL,
      PRIMARY KEY (mint, ts)
    );

    CREATE TABLE IF NOT EXISTS earnings (
      symbol TEXT NOT NULL,
      date   TEXT NOT NULL,
      timing TEXT NOT NULL,
      PRIMARY KEY (symbol, date)
    );

    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  // Additive migration: logo URL per token (added 2026-09-12).
  const cols = db.prepare("PRAGMA table_info(tokens)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "logo")) db.exec("ALTER TABLE tokens ADD COLUMN logo TEXT");
  return db;
}

export type TokenRow = {
  mint: string;
  symbol: string;
  name: string;
  underlying: string;
  issuer: string;
  decimals: number;
  logo: string | null;
  active: number;
  updated_at: number;
};

export type SnapshotRow = {
  mint: string;
  ts: number;
  usd_price: number | null;
  ref_price: number | null;
  ref_source: string | null;
  ref_updated_at: number | null;
  liquidity: number | null;
  block_id: number | null;
};

export type CandleRow = {
  mint: string;
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export function upsertTokens(rows: Omit<TokenRow, "updated_at" | "active">[]): void {
  const d = getDb();
  const now = Date.now();
  const stmt = d.prepare(`
    INSERT INTO tokens (mint, symbol, name, underlying, issuer, decimals, logo, active, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    ON CONFLICT(mint) DO UPDATE SET
      symbol = excluded.symbol, name = excluded.name, underlying = excluded.underlying,
      issuer = excluded.issuer, decimals = excluded.decimals, logo = excluded.logo, active = 1,
      updated_at = excluded.updated_at
  `);
  d.exec("BEGIN");
  try {
    for (const r of rows) {
      stmt.run(r.mint, r.symbol, r.name, r.underlying, r.issuer, r.decimals, r.logo, now);
    }
    d.exec("COMMIT");
  } catch (err) {
    d.exec("ROLLBACK");
    throw err;
  }
}

/** Tokens that dropped out of the universe stop being tracked. */
export function deactivateTokensExcept(mints: string[]): void {
  const d = getDb();
  const placeholders = mints.map(() => "?").join(",");
  d.prepare(`UPDATE tokens SET active = 0 WHERE mint NOT IN (${placeholders})`).run(...mints);
}

export function listTokens(): TokenRow[] {
  return getDb()
    .prepare("SELECT * FROM tokens WHERE active = 1 ORDER BY underlying, issuer")
    .all() as TokenRow[];
}

export function insertSnapshots(rows: SnapshotRow[]): void {
  const d = getDb();
  const stmt = d.prepare(`
    INSERT OR REPLACE INTO snapshots
      (mint, ts, usd_price, ref_price, ref_source, ref_updated_at, liquidity, block_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  d.exec("BEGIN");
  try {
    for (const r of rows) {
      stmt.run(
        r.mint,
        r.ts,
        r.usd_price,
        r.ref_price,
        r.ref_source,
        r.ref_updated_at,
        r.liquidity,
        r.block_id,
      );
    }
    d.exec("COMMIT");
  } catch (err) {
    d.exec("ROLLBACK");
    throw err;
  }
}

/** Latest snapshot per active token. */
export function latestSnapshots(): SnapshotRow[] {
  return getDb()
    .prepare(
      `SELECT s.* FROM snapshots s
       JOIN (SELECT mint, MAX(ts) AS ts FROM snapshots GROUP BY mint) m
         ON m.mint = s.mint AND m.ts = s.ts`,
    )
    .all() as SnapshotRow[];
}

export function snapshotsSince(mint: string, sinceTs: number): SnapshotRow[] {
  return getDb()
    .prepare("SELECT * FROM snapshots WHERE mint = ? AND ts >= ? ORDER BY ts")
    .all(mint, sinceTs) as SnapshotRow[];
}

/** Sparkline input: one price per bucket for every token since sinceTs. */
export function sparkSeries(sinceTs: number, bucketMs: number): Map<string, number[]> {
  const rows = getDb()
    .prepare(
      `SELECT mint, (ts / ?) * ? AS bucket, AVG(usd_price) AS price
       FROM snapshots WHERE ts >= ? AND usd_price IS NOT NULL
       GROUP BY mint, bucket ORDER BY mint, bucket`,
    )
    .all(bucketMs, bucketMs, sinceTs) as { mint: string; bucket: number; price: number }[];
  const out = new Map<string, number[]>();
  for (const r of rows) {
    const arr = out.get(r.mint) ?? [];
    arr.push(r.price);
    out.set(r.mint, arr);
  }
  return out;
}

export function upsertCandles(rows: CandleRow[]): void {
  const d = getDb();
  const stmt = d.prepare(`
    INSERT OR REPLACE INTO candles (mint, ts, open, high, low, close, volume)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  d.exec("BEGIN");
  try {
    for (const r of rows) stmt.run(r.mint, r.ts, r.open, r.high, r.low, r.close, r.volume);
    d.exec("COMMIT");
  } catch (err) {
    d.exec("ROLLBACK");
    throw err;
  }
}

export function candlesSince(mint: string, sinceTs: number): CandleRow[] {
  return getDb()
    .prepare("SELECT * FROM candles WHERE mint = ? AND ts >= ? ORDER BY ts")
    .all(mint, sinceTs) as CandleRow[];
}

export function latestCandleTs(mint: string): number | null {
  const row = getDb().prepare("SELECT MAX(ts) AS ts FROM candles WHERE mint = ?").get(mint) as
    | { ts: number | null }
    | undefined;
  return row?.ts ?? null;
}

export type EarningsRow = { symbol: string; date: string; timing: string };

export function replaceEarnings(rows: EarningsRow[]): void {
  const d = getDb();
  d.exec("BEGIN");
  try {
    d.exec("DELETE FROM earnings");
    const stmt = d.prepare("INSERT OR REPLACE INTO earnings (symbol, date, timing) VALUES (?, ?, ?)");
    for (const r of rows) stmt.run(r.symbol, r.date, r.timing);
    d.exec("COMMIT");
  } catch (err) {
    d.exec("ROLLBACK");
    throw err;
  }
}

export function upcomingEarnings(fromYmd: string, limit = 8): EarningsRow[] {
  return getDb()
    .prepare("SELECT * FROM earnings WHERE date >= ? ORDER BY date LIMIT ?")
    .all(fromYmd, limit) as EarningsRow[];
}

export function nextEarningsFor(symbol: string, fromYmd: string): EarningsRow | null {
  const row = getDb()
    .prepare("SELECT * FROM earnings WHERE symbol = ? AND date >= ? ORDER BY date LIMIT 1")
    .get(symbol, fromYmd) as EarningsRow | undefined;
  return row ?? null;
}

export function getMeta(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM meta WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setMeta(key: string, value: string): void {
  getDb()
    .prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, value);
}

export function pruneSnapshots(olderThanTs: number): void {
  getDb().prepare("DELETE FROM snapshots WHERE ts < ?").run(olderThanTs);
}
