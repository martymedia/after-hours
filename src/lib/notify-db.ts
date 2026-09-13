// Storage for notifications: push subscriptions per wallet, price alerts,
// the orders we watch for fills, and a log so nothing is sent twice.
// Tables are created on first use so the main schema stays untouched.

import { getDb } from "./db.ts";

let ready = false;
function db() {
  const d = getDb();
  if (!ready) {
    d.exec(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        endpoint   TEXT PRIMARY KEY,
        owner      TEXT NOT NULL,
        p256dh     TEXT NOT NULL,
        auth       TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_ok    INTEGER
      );
      CREATE INDEX IF NOT EXISTS push_owner ON push_subscriptions(owner);

      CREATE TABLE IF NOT EXISTS alerts (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        owner      TEXT NOT NULL,
        mint       TEXT NOT NULL,
        kind       TEXT NOT NULL,
        threshold  REAL NOT NULL,
        created_at INTEGER NOT NULL,
        fired_at   INTEGER
      );
      CREATE INDEX IF NOT EXISTS alerts_owner ON alerts(owner);

      CREATE TABLE IF NOT EXISTS order_watch (
        order_key  TEXT PRIMARY KEY,
        owner      TEXT NOT NULL,
        mint       TEXT NOT NULL,
        side       TEXT NOT NULL,
        usd        REAL NOT NULL,
        shares     REAL NOT NULL,
        price      REAL NOT NULL,
        remaining  REAL NOT NULL,
        first_seen INTEGER NOT NULL,
        last_seen  INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS order_watch_owner ON order_watch(owner);

      CREATE TABLE IF NOT EXISTS notified (
        key  TEXT PRIMARY KEY,
        ts   INTEGER NOT NULL
      );
    `);
    ready = true;
  }
  return d;
}

export type PushSubscriptionRow = { endpoint: string; owner: string; p256dh: string; auth: string };
export type AlertRow = { id: number; owner: string; mint: string; kind: "cheaper" | "pricier"; threshold: number; created_at: number; fired_at: number | null };
export type OrderWatchRow = {
  order_key: string;
  owner: string;
  mint: string;
  side: string;
  usd: number;
  shares: number;
  price: number;
  remaining: number;
  first_seen: number;
  last_seen: number;
};

export function upsertSubscription(owner: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }): void {
  db()
    .prepare(
      `INSERT INTO push_subscriptions (endpoint, owner, p256dh, auth, created_at, last_ok)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET owner = excluded.owner, p256dh = excluded.p256dh, auth = excluded.auth`,
    )
    .run(sub.endpoint, owner, sub.keys.p256dh, sub.keys.auth, Date.now(), Date.now());
}

export function deleteSubscription(endpoint: string): void {
  db().prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(endpoint);
}

export function subscriptionsFor(owner: string): PushSubscriptionRow[] {
  return db().prepare("SELECT endpoint, owner, p256dh, auth FROM push_subscriptions WHERE owner = ?").all(owner) as PushSubscriptionRow[];
}

export function hasSubscription(owner: string, endpoint: string): boolean {
  return Boolean(db().prepare("SELECT 1 FROM push_subscriptions WHERE owner = ? AND endpoint = ?").get(owner, endpoint));
}

export function subscribedOwners(): string[] {
  return (db().prepare("SELECT DISTINCT owner FROM push_subscriptions").all() as { owner: string }[]).map((r) => r.owner);
}

export function createAlert(owner: string, mint: string, kind: "cheaper" | "pricier", threshold: number): AlertRow {
  const res = db().prepare("INSERT INTO alerts (owner, mint, kind, threshold, created_at) VALUES (?, ?, ?, ?, ?)").run(owner, mint, kind, threshold, Date.now());
  return db().prepare("SELECT * FROM alerts WHERE id = ?").get(Number(res.lastInsertRowid)) as AlertRow;
}

export function listAlerts(owner: string): AlertRow[] {
  return db().prepare("SELECT * FROM alerts WHERE owner = ? ORDER BY created_at DESC").all(owner) as AlertRow[];
}

export function deleteAlert(id: number, owner: string): void {
  db().prepare("DELETE FROM alerts WHERE id = ? AND owner = ?").run(id, owner);
}

export function armedAlerts(): AlertRow[] {
  return db().prepare("SELECT * FROM alerts WHERE fired_at IS NULL").all() as AlertRow[];
}

export function markAlertFired(id: number): void {
  db().prepare("UPDATE alerts SET fired_at = ? WHERE id = ?").run(Date.now(), id);
}

export function watchedOrders(owner: string): OrderWatchRow[] {
  return db().prepare("SELECT * FROM order_watch WHERE owner = ?").all(owner) as OrderWatchRow[];
}

export function upsertWatchedOrder(row: Omit<OrderWatchRow, "first_seen" | "last_seen">): void {
  const now = Date.now();
  db()
    .prepare(
      `INSERT INTO order_watch (order_key, owner, mint, side, usd, shares, price, remaining, first_seen, last_seen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(order_key) DO UPDATE SET remaining = excluded.remaining, last_seen = excluded.last_seen`,
    )
    .run(row.order_key, row.owner, row.mint, row.side, row.usd, row.shares, row.price, row.remaining, now, now);
}

export function deleteWatchedOrder(orderKey: string): void {
  db().prepare("DELETE FROM order_watch WHERE order_key = ?").run(orderKey);
}

/** True the first time a key is seen; false afterwards. */
export function firstTime(key: string): boolean {
  const seen = db().prepare("SELECT 1 FROM notified WHERE key = ?").get(key);
  if (seen) return false;
  db().prepare("INSERT INTO notified (key, ts) VALUES (?, ?)").run(key, Date.now());
  return true;
}
