// Portfolio view of a connected wallet: which tracked stock tokens it holds,
// what they are worth, how each position has done since it was bought, and
// the recent swaps. Read from the RPC on the server so the browser never
// talks to the RPC for reads, and cached per wallet for a short while
// because one page load asks for a lot.

import { listTokens, latestSnapshots, nextEarningsFor, snapshotAt, sparkSeries, type TokenRow } from "./db.ts";
import { ISSUERS, type IssuerId } from "./issuers.ts";
import { USDC_MINT } from "./jupiter.ts";
import { nyYmd } from "./market-phase.ts";

// Server-side reads. A domain-locked Helius key answers 403 to server calls
// unless the server IP is allowlisted, and publicnode gates account scans, so
// the Foundation endpoint (fine without a browser Origin) is the fallback.
const RPC_URLS = [
  process.env.SOLANA_RPC_SERVER_URL ?? process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "",
  "https://api.mainnet-beta.solana.com",
].filter(Boolean);
const TOKEN_PROGRAMS = ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"];
const CACHE_MS = 45_000;
const SIGNATURE_LIMIT = 50;
const CONCURRENCY = 5;
const DAY_MS = 24 * 3600_000;

export type Holding = {
  mint: string;
  symbol: string;
  name: string;
  underlying: string;
  issuer: IssuerId;
  issuerName: string;
  logo: string | null;
  amount: number;
  price: number | null;
  reference: number | null;
  /** Onchain price vs reference, percent. */
  gapPct: number | null;
  value: number | null;
  /** Share of the stocks value, 0..1. */
  share: number;
  /** Average USDC paid per share for the units we could trace. */
  avgCost: number | null;
  /** Units with a known cost; less than amount when older buys fell out of the scan. */
  basisUnits: number;
  unrealized: number | null;
  unrealizedPct: number | null;
  realized: number;
  change24hPct: number | null;
  spark: number[];
  nextEarnings: string | null;
};

export type ActivityKind = "bought" | "sold" | "received" | "sent";

export type Activity = {
  signature: string;
  /** Unix ms of the block. */
  ts: number;
  kind: ActivityKind;
  mint: string;
  symbol: string;
  name: string;
  underlying: string;
  logo: string | null;
  amount: number;
  /** USDC that changed hands in the same transaction, if any. */
  usd: number | null;
  /** USDC per share in this swap. */
  perShare: number | null;
  /** Reference (Wall Street) price at the time, from our snapshots. */
  refAtTime: number | null;
  /** perShare vs refAtTime, percent. Negative: paid less than the last print. */
  vsRefPct: number | null;
  feeSol: number;
};

export type WalletData = {
  owner: string;
  generatedAt: string;
  sol: number;
  usdc: number;
  totalValue: number;
  /** Cost of the traced units. */
  costBasis: number;
  unrealized: number | null;
  unrealizedPct: number | null;
  realized: number;
  /** True when some held units have no traced buy (older than the scan window). */
  partialBasis: boolean;
  change24h: number | null;
  change24hPct: number | null;
  /** USDC saved (positive) or overpaid (negative) across buys vs the reference at the time. */
  edgeUsd: number | null;
  edgeBuys: number;
  feesSol: number;
  holdings: Holding[];
  activity: Activity[];
};

const cache = new Map<string, { ts: number; data: WalletData }>();

type RpcTokenAccount = { account: { data: { parsed: { info: { mint: string; tokenAmount: { uiAmount: number | null } } } } } };
type RpcTokenBalance = { mint: string; owner?: string; uiTokenAmount: { uiAmount: number | null } };
type RpcTransaction = {
  blockTime: number | null;
  meta: { err: unknown; fee: number; preTokenBalances: RpcTokenBalance[]; postTokenBalances: RpcTokenBalance[] } | null;
};

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  let lastError: Error | null = null;
  for (const url of RPC_URLS) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 401 || res.status === 403) {
      lastError = new Error(`RPC ${method} ${res.status}`);
      continue;
    }
    if (!res.ok) throw new Error(`RPC ${method} ${res.status}`);
    const json = (await res.json()) as { result?: T; error?: { message: string } };
    if (json.error) {
      // Gated method on this provider: try the next one.
      if (/personal token|not allowed|forbidden/i.test(json.error.message)) {
        lastError = new Error(`RPC ${method}: ${json.error.message}`);
        continue;
      }
      throw new Error(`RPC ${method}: ${json.error.message}`);
    }
    return json.result as T;
  }
  throw lastError ?? new Error(`RPC ${method}: no endpoint`);
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

/** Average-cost bookkeeping per mint, fed oldest to newest. */
type Book = { units: number; cost: number; realized: number };

function applyToBook(book: Book, a: Activity): void {
  if (a.kind === "bought" && a.usd != null) {
    book.units += a.amount;
    book.cost += a.usd;
    return;
  }
  if (a.kind === "received") return; // no cost known; stays outside the basis
  // sold or sent: remove at average cost
  if (book.units <= 0) return;
  const avg = book.cost / book.units;
  const taken = Math.min(a.amount, book.units);
  if (a.kind === "sold" && a.usd != null) book.realized += a.usd * (taken / a.amount) - avg * taken;
  book.units -= taken;
  book.cost -= avg * taken;
}

export async function getWallet(owner: string): Promise<WalletData> {
  const hit = cache.get(owner);
  if (hit && Date.now() - hit.ts < CACHE_MS) return hit.data;

  const now = Date.now();
  const tokens = new Map<string, TokenRow>(listTokens().map((t) => [t.mint, t]));
  const snaps = new Map(latestSnapshots().map((s) => [s.mint, s]));

  const [lamports, accountsA, accountsB, signatures] = await Promise.all([
    rpc<{ value: number }>("getBalance", [owner]),
    rpc<{ value: RpcTokenAccount[] }>("getTokenAccountsByOwner", [owner, { programId: TOKEN_PROGRAMS[0] }, { encoding: "jsonParsed" }]),
    rpc<{ value: RpcTokenAccount[] }>("getTokenAccountsByOwner", [owner, { programId: TOKEN_PROGRAMS[1] }, { encoding: "jsonParsed" }]),
    rpc<{ signature: string; err: unknown }[]>("getSignaturesForAddress", [owner, { limit: SIGNATURE_LIMIT }]),
  ]);

  // Balances per mint (a wallet can hold the same mint in two accounts).
  const amounts = new Map<string, number>();
  for (const acc of [...accountsA.value, ...accountsB.value]) {
    const info = acc.account.data.parsed.info;
    amounts.set(info.mint, (amounts.get(info.mint) ?? 0) + (info.tokenAmount.uiAmount ?? 0));
  }

  // Activity: every recent transaction that moved a tracked token.
  const txs = await mapLimit(
    signatures.filter((s) => !s.err),
    CONCURRENCY,
    async (s) => {
      try {
        const tx = await rpc<RpcTransaction | null>("getTransaction", [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]);
        return { signature: s.signature, tx };
      } catch {
        return { signature: s.signature, tx: null };
      }
    },
  );
  const activity: Activity[] = [];
  for (const { signature, tx } of txs) {
    if (!tx?.meta || tx.meta.err) continue;
    const deltas = new Map<string, number>();
    for (const b of tx.meta.preTokenBalances) if (b.owner === owner) deltas.set(b.mint, (deltas.get(b.mint) ?? 0) - (b.uiTokenAmount.uiAmount ?? 0));
    for (const b of tx.meta.postTokenBalances) if (b.owner === owner) deltas.set(b.mint, (deltas.get(b.mint) ?? 0) + (b.uiTokenAmount.uiAmount ?? 0));
    const usdcDelta = deltas.get(USDC_MINT) ?? 0;
    const ts = (tx.blockTime ?? 0) * 1000;
    for (const [mint, delta] of deltas) {
      const t = tokens.get(mint);
      if (!t || Math.abs(delta) < 1e-9) continue;
      const usd = Math.abs(usdcDelta) > 1e-6 ? Math.abs(usdcDelta) : null;
      const amount = Math.abs(delta);
      const kind: ActivityKind = delta > 0 ? (usdcDelta < 0 ? "bought" : "received") : usdcDelta > 0 ? "sold" : "sent";
      const perShare = usd != null ? usd / amount : null;
      const refAtTime = ts ? (snapshotAt(mint, ts)?.ref_price ?? null) : null;
      activity.push({
        signature,
        ts,
        kind,
        mint,
        symbol: t.symbol,
        name: t.name,
        underlying: t.underlying,
        logo: t.logo ?? null,
        amount,
        usd,
        perShare,
        refAtTime,
        vsRefPct: perShare != null && refAtTime ? (perShare / refAtTime - 1) * 100 : null,
        feeSol: tx.meta.fee / 1e9,
      });
    }
  }
  activity.sort((a, b) => a.ts - b.ts);

  // Cost basis per mint from the traced history.
  const books = new Map<string, Book>();
  for (const a of activity) {
    const book = books.get(a.mint) ?? { units: 0, cost: 0, realized: 0 };
    applyToBook(book, a);
    books.set(a.mint, book);
  }

  const sparks = sparkSeries(now - 2 * DAY_MS, 30 * 60_000);
  const today = nyYmd(new Date(now));

  const holdings: Holding[] = [];
  for (const [mint, amount] of amounts) {
    const t = tokens.get(mint);
    if (!t || amount <= 0) continue;
    const s = snaps.get(mint);
    const price = s?.usd_price ?? null;
    const reference = s?.ref_price ?? null;
    const book = books.get(mint);
    const basisUnits = Math.min(amount, book?.units ?? 0);
    const avgCost = book && book.units > 0 ? book.cost / book.units : null;
    const price24h = snapshotAt(mint, now - DAY_MS)?.usd_price ?? null;
    holdings.push({
      mint,
      symbol: t.symbol,
      name: t.name,
      underlying: t.underlying,
      issuer: t.issuer as IssuerId,
      issuerName: ISSUERS[t.issuer as IssuerId]?.name ?? t.issuer,
      logo: t.logo ?? null,
      amount,
      price,
      reference,
      gapPct: price != null && reference ? (price / reference - 1) * 100 : null,
      value: price != null ? amount * price : null,
      share: 0,
      avgCost,
      basisUnits,
      unrealized: price != null && avgCost != null && basisUnits > 0 ? (price - avgCost) * basisUnits : null,
      unrealizedPct: price != null && avgCost ? (price / avgCost - 1) * 100 : null,
      realized: book?.realized ?? 0,
      change24hPct: price != null && price24h ? (price / price24h - 1) * 100 : null,
      spark: sparks.get(mint) ?? [],
      nextEarnings: nextEarningsFor(t.underlying, today)?.date ?? null,
    });
  }
  holdings.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const totalValue = holdings.reduce((sum, h) => sum + (h.value ?? 0), 0);
  for (const h of holdings) h.share = totalValue > 0 && h.value != null ? h.value / totalValue : 0;

  const costBasis = holdings.reduce((sum, h) => sum + (h.avgCost ?? 0) * h.basisUnits, 0);
  const traced = holdings.filter((h) => h.unrealized != null);
  const unrealized = traced.length ? traced.reduce((sum, h) => sum + (h.unrealized ?? 0), 0) : null;
  const with24h = holdings.filter((h) => h.change24hPct != null && h.value != null);
  const value24h = with24h.reduce((sum, h) => sum + (h.value ?? 0) / (1 + (h.change24hPct ?? 0) / 100), 0);
  const change24h = with24h.length ? with24h.reduce((sum, h) => sum + (h.value ?? 0), 0) - value24h : null;
  const buysWithRef = activity.filter((a) => a.kind === "bought" && a.refAtTime != null && a.perShare != null);
  const edgeUsd = buysWithRef.length ? buysWithRef.reduce((sum, a) => sum + ((a.refAtTime ?? 0) - (a.perShare ?? 0)) * a.amount, 0) : null;

  const data: WalletData = {
    owner,
    generatedAt: new Date(now).toISOString(),
    sol: lamports.value / 1e9,
    usdc: amounts.get(USDC_MINT) ?? 0,
    totalValue,
    costBasis,
    unrealized,
    unrealizedPct: unrealized != null && costBasis > 0 ? (unrealized / costBasis) * 100 : null,
    realized: [...books.values()].reduce((sum, b) => sum + b.realized, 0),
    partialBasis: holdings.some((h) => h.basisUnits < h.amount - 1e-9),
    change24h,
    change24hPct: change24h != null && value24h > 0 ? (change24h / value24h) * 100 : null,
    edgeUsd,
    edgeBuys: buysWithRef.length,
    feesSol: activity.reduce((sum, a) => sum + a.feeSol, 0),
    holdings,
    activity: [...activity].reverse(),
  };
  cache.set(owner, { ts: now, data });
  return data;
}
