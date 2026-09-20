// Portfolio view of a connected wallet: which tracked stock tokens it holds,
// what they are worth, how each position has done since it was bought, and
// the recent swaps. Read from the RPC on the server so the browser never
// talks to the RPC for reads, and cached per wallet for a short while
// because one page load asks for a lot.

import {
  candlesSince,
  listTokens,
  latestSnapshots,
  nextEarningsFor,
  snapshotAt,
  sparkSeries,
  type TokenRow,
} from "./db.ts";
import { ISSUERS, isPreIpo, type IssuerId } from "./issuers.ts";
import { multiplierOf, USDC_MINT, type ScaledUiConfig } from "./jupiter.ts";
import { nyYmd } from "./market-phase.ts";
import { SITE_URL } from "./brand.ts";
import { getRadar } from "./radar.ts";

// Server-side reads. Helius checks the Origin header against the allowed
// domains even for server calls (the IP allowlist alone still gets 403), so
// we send our own site origin. publicnode gates account scans, so the
// Foundation endpoint (fine without a browser Origin) stays as the fallback.
const RPC_URLS = [
  process.env.SOLANA_RPC_SERVER_URL ??
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
    "",
  "https://api.mainnet-beta.solana.com",
].filter(Boolean);
const TOKEN_PROGRAMS = [
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
];
const CACHE_MS = 45_000;
/** Positions worth less than this are hidden: no market takes them. */
const DUST_USD = 0.01;
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
  /** A private company: it lives under /pre-ipo and has no closing bell. */
  preIpo: boolean;
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

export type ActivityKind =
  "bought" | "sold" | "received" | "sent" | "order_open" | "order_cancel";

export type Activity = {
  signature: string;
  /** Unix ms of the block. */
  ts: number;
  kind: ActivityKind;
  /** Filled by a Jupiter Trigger limit order (the keeper signed, not the user). */
  order?: boolean;
  mint: string;
  symbol: string;
  name: string;
  underlying: string;
  preIpo: boolean;
  logo: string | null;
  amount: number;
  /** USDC that changed hands in the same transaction, if any. */
  usd: number | null;
  /** USDC per share in this swap. */
  perShare: number | null;
  /**
   * The reference at the time, from our snapshots: the last Wall Street print
   * for a listed stock, the issuer's mark for a private company.
   */
  refAtTime: number | null;
  /** perShare vs refAtTime, percent. Negative: paid less than the reference. */
  vsRefPct: number | null;
  feeSol: number;
};

export type WalletData = {
  owner: string;
  generatedAt: string;
  /** "Friday's close", "Wall Street", ... for the current market phase. */
  referencePhrase: string;
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
  /** Stocks value over the last seven days at current holdings, hourly. */
  history: { ts: number; value: number }[];
  /** Tradable stocks for the alert picker: mint, symbol, name. */
  stocks: { mint: string; symbol: string; name: string }[];
  holdings: Holding[];
  activity: Activity[];
};

const cache = new Map<string, { ts: number; data: WalletData }>();

type RpcTokenAccount = {
  account: {
    data: {
      parsed: {
        info: { mint: string; tokenAmount: { uiAmount: number | null } };
      };
    };
  };
};
type RpcTokenBalance = {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount: { uiAmount: number | null };
};
export type RpcTransaction = {
  blockTime: number | null;
  meta: {
    err: unknown;
    fee: number;
    preTokenBalances: RpcTokenBalance[];
    postTokenBalances: RpcTokenBalance[];
  } | null;
  transaction?: { message: { instructions: { programId: string }[] } };
};

/** Jupiter Trigger (limit orders). Fills are signed by its keeper, and the
 *  funds come from the order account, not from the wallet directly. */
export const TRIGGER_PROGRAM = "j1o2qRpjcyUwEvwtcfhEQefh773ZgjxcVRry7LDqg5X";

/** Raw units of one mint across the owner's token accounts, or null if the RPC failed. */
export async function rawBalance(
  owner: string,
  mint: string,
): Promise<bigint | null> {
  try {
    const res = await rpc<{
      value: {
        account: {
          data: { parsed: { info: { tokenAmount: { amount: string } } } };
        };
      }[];
    }>("getTokenAccountsByOwner", [
      owner,
      { mint },
      { encoding: "jsonParsed" },
    ]);
    return res.value.reduce(
      (sum, a) => sum + BigInt(a.account.data.parsed.info.tokenAmount.amount),
      0n,
    );
  } catch {
    return null;
  }
}

/** Every token balance of a wallet, by mint, in UI units. */
export async function allBalances(
  owner: string,
): Promise<Record<string, number>> {
  const parts = await Promise.all(
    TOKEN_PROGRAMS.map((programId) =>
      rpc<{ value: RpcTokenAccount[] }>("getTokenAccountsByOwner", [
        owner,
        { programId },
        { encoding: "jsonParsed" },
      ]),
    ),
  );
  const amounts: Record<string, number> = {};
  for (const part of parts)
    for (const acc of part.value) {
      const info = acc.account.data.parsed.info;
      const n = info.tokenAmount.uiAmount ?? 0;
      if (n > 0) amounts[info.mint] = (amounts[info.mint] ?? 0) + n;
    }
  return amounts;
}

export async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  let lastError: Error | null = null;
  for (const url of RPC_URLS) {
    const res = await fetch(url, {
      method: "POST",
      // Helius matches the Origin against its allowed domains; the Foundation
      // endpoint refuses requests that carry one, so only Helius gets it.
      headers: {
        "content-type": "application/json",
        ...(url.includes("helius") ? { origin: SITE_URL } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 401 || res.status === 403) {
      lastError = new Error(`RPC ${method} ${res.status}`);
      continue;
    }
    if (!res.ok) throw new Error(`RPC ${method} ${res.status}`);
    const json = (await res.json()) as {
      result?: T;
      error?: { message: string };
    };
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

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
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
  // Money or shares parked in a limit order still belong to the wallet.
  if (a.kind === "order_open" || a.kind === "order_cancel") return;
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
  if (a.kind === "sold" && a.usd != null)
    book.realized += a.usd * (taken / a.amount) - avg * taken;
  book.units -= taken;
  book.cost -= avg * taken;
}

export async function getWallet(
  owner: string,
  fresh = false,
): Promise<WalletData> {
  // fresh: right after the user's own trade, or the refresh button.
  const hit = cache.get(owner);
  if (!fresh && hit && Date.now() - hit.ts < CACHE_MS) return hit.data;

  const now = Date.now();
  const tokens = new Map<string, TokenRow>(
    listTokens().map((t) => [t.mint, t]),
  );
  const snaps = new Map(latestSnapshots().map((s) => [s.mint, s]));

  const [lamports, accountsA, accountsB, signatures] = await Promise.all([
    rpc<{ value: number }>("getBalance", [owner]),
    rpc<{ value: RpcTokenAccount[] }>("getTokenAccountsByOwner", [
      owner,
      { programId: TOKEN_PROGRAMS[0] },
      { encoding: "jsonParsed" },
    ]),
    rpc<{ value: RpcTokenAccount[] }>("getTokenAccountsByOwner", [
      owner,
      { programId: TOKEN_PROGRAMS[1] },
      { encoding: "jsonParsed" },
    ]),
    rpc<{ signature: string; err: unknown }[]>("getSignaturesForAddress", [
      owner,
      { limit: SIGNATURE_LIMIT },
    ]),
  ]);

  // Balances per mint (a wallet can hold the same mint in two accounts).
  const amounts = new Map<string, number>();
  for (const acc of [...accountsA.value, ...accountsB.value]) {
    const info = acc.account.data.parsed.info;
    amounts.set(
      info.mint,
      (amounts.get(info.mint) ?? 0) + (info.tokenAmount.uiAmount ?? 0),
    );
  }

  // Activity: every recent transaction that moved a tracked token.
  const txs = await mapLimit(
    signatures.filter((s) => !s.err),
    CONCURRENCY,
    async (s) => {
      try {
        const tx = await rpc<RpcTransaction | null>("getTransaction", [
          s.signature,
          { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
        ]);
        return { signature: s.signature, tx };
      } catch {
        return { signature: s.signature, tx: null };
      }
    },
  );
  // Limit orders: which stock each order account was for, learned from the
  // opening transaction (the wallet's stock account and the order's USDC
  // account both appear there). Cancels only show the order account.
  const orderStock = new Map<string, string>();
  for (const { tx } of txs) {
    if (
      !tx?.meta ||
      tx.meta.err ||
      !tx.transaction?.message.instructions.some(
        (i) => i.programId === TRIGGER_PROGRAM,
      )
    )
      continue;
    const stock = tx.meta.postTokenBalances.find(
      (b) => b.owner === owner && tokens.has(b.mint),
    )?.mint;
    const orderOwner = [
      ...tx.meta.postTokenBalances,
      ...tx.meta.preTokenBalances,
    ].find((b) => b.owner && b.owner !== owner && b.mint === USDC_MINT)?.owner;
    if (stock && orderOwner && !orderStock.has(orderOwner))
      orderStock.set(orderOwner, stock);
  }

  // The rate that was in force when a given trade happened, not today's.
  const scaled = new Map<string, ScaledUiConfig | null>();
  for (const [mint, t] of tokens) {
    let config: ScaledUiConfig | null = null;
    try {
      config = t.scaled_ui ? (JSON.parse(t.scaled_ui) as ScaledUiConfig) : null;
    } catch {
      // A malformed row means multiplier 1, which is the old behaviour.
    }
    scaled.set(mint, config);
  }
  const uiUnits = (mint: string, raw: number, at: number) =>
    raw * multiplierOf(scaled.get(mint), at || Date.now());

  const activity: Activity[] = [];
  for (const { signature, tx } of txs) {
    if (!tx?.meta || tx.meta.err) continue;
    const ts = (tx.blockTime ?? 0) * 1000;
    const raw = new Map<string, number>();
    for (const b of tx.meta.preTokenBalances)
      if (b.owner === owner)
        raw.set(b.mint, (raw.get(b.mint) ?? 0) - (b.uiTokenAmount.uiAmount ?? 0));
    for (const b of tx.meta.postTokenBalances)
      if (b.owner === owner)
        raw.set(b.mint, (raw.get(b.mint) ?? 0) + (b.uiTokenAmount.uiAmount ?? 0));
    const deltas = new Map(
      [...raw].map(([mint, d]) => [mint, uiUnits(mint, d, ts)]),
    );
    const usdcDelta = deltas.get(USDC_MINT) ?? 0;
    // Limit-order fill: what the order account paid out (USDC on a buy, shares
    // on a sell) shows up as a decrease on accounts the wallet does not own.
    const fill = Boolean(
      tx.transaction?.message.instructions.some(
        (i) => i.programId === TRIGGER_PROGRAM,
      ),
    );
    const paidOut = new Map<string, number>();
    if (fill) {
      const post = new Map(
        tx.meta.postTokenBalances.map((b) => [b.accountIndex, b]),
      );
      for (const b of tx.meta.preTokenBalances) {
        if (b.owner === owner) continue;
        const after = post.get(b.accountIndex)?.uiTokenAmount.uiAmount ?? 0;
        const d = uiUnits(b.mint, after - (b.uiTokenAmount.uiAmount ?? 0), ts);
        if (d < 0) paidOut.set(b.mint, (paidOut.get(b.mint) ?? 0) - d);
      }
    }
    const usdOut = fill ? (paidOut.get(USDC_MINT) ?? 0) : 0;
    let stockSeen = false;
    for (const [mint, delta] of deltas) {
      const t = tokens.get(mint);
      if (!t || Math.abs(delta) < 1e-9) continue;
      stockSeen = true;
      const usd =
        Math.abs(usdcDelta) > 1e-6
          ? Math.abs(usdcDelta)
          : fill && delta > 0 && usdOut > 1e-6
            ? usdOut
            : null;
      const amount = Math.abs(delta);
      // Shares moving into or out of an order without USDC: a sell order
      // being placed (out) or cancelled (back).
      const parked = fill && usd == null;
      const kind: ActivityKind = parked
        ? delta > 0
          ? "order_cancel"
          : "order_open"
        : delta > 0
          ? usd != null
            ? "bought"
            : "received"
          : usdcDelta > 0
            ? "sold"
            : "sent";
      const perShare = usd != null ? usd / amount : null;
      const refAtTime = ts ? (snapshotAt(mint, ts)?.ref_price ?? null) : null;
      activity.push({
        signature,
        ts,
        kind,
        order: fill || undefined,
        mint,
        symbol: t.symbol,
        name: t.name,
        underlying: t.underlying,
        preIpo: isPreIpo(t.issuer as IssuerId),
        logo: t.logo ?? null,
        amount,
        usd,
        perShare,
        refAtTime,
        vsRefPct:
          perShare != null && refAtTime
            ? (perShare / refAtTime - 1) * 100
            : null,
        feeSol: fill ? 0 : tx.meta.fee / 1e9,
      });
    }
    // USDC parked in a buy order (open) or coming back (cancel): no shares move.
    if (
      fill &&
      !stockSeen &&
      Math.abs(usdcDelta) > 1e-6 &&
      ![...paidOut.keys()].some((m) => tokens.has(m))
    ) {
      const orderOwner = [
        ...tx.meta.preTokenBalances,
        ...tx.meta.postTokenBalances,
      ].find(
        (b) => b.owner && b.owner !== owner && b.mint === USDC_MINT,
      )?.owner;
      const stockMint =
        (orderOwner && orderStock.get(orderOwner)) ??
        tx.meta.postTokenBalances.find(
          (b) => b.owner === owner && tokens.has(b.mint),
        )?.mint ??
        null;
      const t = stockMint ? tokens.get(stockMint) : undefined;
      activity.push({
        signature,
        ts,
        kind: usdcDelta < 0 ? "order_open" : "order_cancel",
        order: true,
        mint: t?.mint ?? USDC_MINT,
        symbol: t?.symbol ?? "USDC",
        name: t?.name ?? "Limit order",
        underlying: t?.underlying ?? "",
        preIpo: t ? isPreIpo(t.issuer as IssuerId) : false,
        logo: t?.logo ?? null,
        amount: Math.abs(usdcDelta),
        usd: Math.abs(usdcDelta),
        perShare: null,
        refAtTime: null,
        vsRefPct: null,
        feeSol: tx.meta.fee / 1e9,
      });
      continue;
    }
    // Sell fill: the shares left the order account, only USDC reached the wallet.
    if (fill && !stockSeen && usdcDelta > 1e-6) {
      for (const [mint, amount] of paidOut) {
        const t = tokens.get(mint);
        if (!t || amount < 1e-9) continue;
        const refAtTime = ts ? (snapshotAt(mint, ts)?.ref_price ?? null) : null;
        const perShare = usdcDelta / amount;
        activity.push({
          signature,
          ts,
          kind: "sold",
          order: true,
          mint,
          symbol: t.symbol,
          name: t.name,
          underlying: t.underlying,
          preIpo: isPreIpo(t.issuer as IssuerId),
          logo: t.logo ?? null,
          amount,
          usd: usdcDelta,
          perShare,
          refAtTime,
          vsRefPct: refAtTime ? (perShare / refAtTime - 1) * 100 : null,
          feeSol: 0,
        });
      }
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
    // Dust left behind by rounding (fractions of a cent) is not a position.
    if (price != null && amount * price < DUST_USD) continue;
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
      preIpo: isPreIpo(t.issuer as IssuerId),
      logo: t.logo ?? null,
      amount,
      price,
      reference,
      gapPct: price != null && reference ? (price / reference - 1) * 100 : null,
      value: price != null ? amount * price : null,
      share: 0,
      avgCost,
      basisUnits,
      unrealized:
        price != null && avgCost != null && basisUnits > 0
          ? (price - avgCost) * basisUnits
          : null,
      unrealizedPct:
        price != null && avgCost ? (price / avgCost - 1) * 100 : null,
      realized: book?.realized ?? 0,
      change24hPct:
        price != null && price24h ? (price / price24h - 1) * 100 : null,
      spark: sparks.get(mint) ?? [],
      nextEarnings: nextEarningsFor(t.underlying, today)?.date ?? null,
    });
  }
  holdings.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const totalValue = holdings.reduce((sum, h) => sum + (h.value ?? 0), 0);
  for (const h of holdings)
    h.share = totalValue > 0 && h.value != null ? h.value / totalValue : 0;

  // Value history: today's holdings priced with each hour's close, last price carried forward.
  const HOUR = 3600_000;
  const from = Math.floor((now - 7 * DAY_MS) / HOUR) * HOUR;
  const perMint = holdings.map((h) => ({
    amount: h.amount,
    byHour: new Map(
      candlesSince(h.mint, from).map((c) => [
        Math.floor(c.ts / HOUR) * HOUR,
        c.close,
      ]),
    ),
  }));
  const history: { ts: number; value: number }[] = [];
  const last = new Map<number, number>();
  for (let ts = from; ts <= now; ts += HOUR) {
    let value = 0;
    let known = false;
    perMint.forEach((m, i) => {
      const px = m.byHour.get(ts) ?? last.get(i);
      if (px != null) {
        last.set(i, px);
        value += m.amount * px;
        known = true;
      }
    });
    if (known) history.push({ ts, value: Number(value.toFixed(2)) });
  }

  const costBasis = holdings.reduce(
    (sum, h) => sum + (h.avgCost ?? 0) * h.basisUnits,
    0,
  );
  const traced = holdings.filter((h) => h.unrealized != null);
  const unrealized = traced.length
    ? traced.reduce((sum, h) => sum + (h.unrealized ?? 0), 0)
    : null;
  const with24h = holdings.filter(
    (h) => h.change24hPct != null && h.value != null,
  );
  const value24h = with24h.reduce(
    (sum, h) => sum + (h.value ?? 0) / (1 + (h.change24hPct ?? 0) / 100),
    0,
  );
  const change24h = with24h.length
    ? with24h.reduce((sum, h) => sum + (h.value ?? 0), 0) - value24h
    : null;
  const buysWithRef = activity.filter(
    (a) => a.kind === "bought" && a.refAtTime != null && a.perShare != null,
  );
  const edgeUsd = buysWithRef.length
    ? buysWithRef.reduce(
        (sum, a) => sum + ((a.refAtTime ?? 0) - (a.perShare ?? 0)) * a.amount,
        0,
      )
    : null;

  const data: WalletData = {
    owner,
    generatedAt: new Date(now).toISOString(),
    referencePhrase: getRadar().reference.phrase,
    sol: lamports.value / 1e9,
    usdc: amounts.get(USDC_MINT) ?? 0,
    totalValue,
    costBasis,
    unrealized,
    unrealizedPct:
      unrealized != null && costBasis > 0
        ? (unrealized / costBasis) * 100
        : null,
    realized: [...books.values()].reduce((sum, b) => sum + b.realized, 0),
    partialBasis: holdings.some((h) => h.basisUnits < h.amount - 1e-9),
    change24h,
    change24hPct:
      change24h != null && value24h > 0 ? (change24h / value24h) * 100 : null,
    edgeUsd,
    edgeBuys: buysWithRef.length,
    feesSol: activity.reduce((sum, a) => sum + a.feeSol, 0),
    history,
    stocks: getRadar()
      .rows.filter((r) => r.tradability === "easy" || r.tradability === "ok")
      .map((r) => ({ mint: r.mint, symbol: r.symbol, name: r.name })),
    holdings,
    activity: [...activity].reverse(),
  };
  cache.set(owner, { ts: now, data });
  return data;
}
