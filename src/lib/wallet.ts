// Portfolio view of a connected wallet: which tracked stock tokens it holds,
// what they are worth right now, and its recent swaps. Read from the RPC on
// the server so the browser never talks to the RPC for reads, and cached per
// wallet for a short while because one page load asks for a lot.

import { listTokens, latestSnapshots, type TokenRow } from "./db.ts";
import { ISSUERS, type IssuerId } from "./issuers.ts";
import { USDC_MINT } from "./jupiter.ts";

// Server-side reads. A domain-locked Helius key answers 403 to server calls
// unless the server IP is allowlisted, and publicnode gates account scans, so
// the Foundation endpoint (fine without a browser Origin) is the fallback.
const RPC_URLS = [
  process.env.SOLANA_RPC_SERVER_URL ?? process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "",
  "https://api.mainnet-beta.solana.com",
].filter(Boolean);
const TOKEN_PROGRAMS = ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"];
const CACHE_MS = 45_000;
const SIGNATURE_LIMIT = 25;
const CONCURRENCY = 5;

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
  gapPct: number | null;
  value: number | null;
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
  feeSol: number;
};

export type WalletData = {
  owner: string;
  generatedAt: string;
  sol: number;
  usdc: number;
  totalValue: number;
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

export async function getWallet(owner: string): Promise<WalletData> {
  const hit = cache.get(owner);
  if (hit && Date.now() - hit.ts < CACHE_MS) return hit.data;

  const tokens = new Map<string, TokenRow>(listTokens().map((t) => [t.mint, t]));
  const snaps = new Map(latestSnapshots().map((s) => [s.mint, s]));

  const [lamports, accountsA, accountsB, signatures] = await Promise.all([
    rpc<{ value: number }>("getBalance", [owner]),
    rpc<{ value: RpcTokenAccount[] }>("getTokenAccountsByOwner", [owner, { programId: TOKEN_PROGRAMS[0] }, { encoding: "jsonParsed" }]),
    rpc<{ value: RpcTokenAccount[] }>("getTokenAccountsByOwner", [owner, { programId: TOKEN_PROGRAMS[1] }, { encoding: "jsonParsed" }]),
    rpc<{ signature: string; err: unknown }[]>("getSignaturesForAddress", [owner, { limit: SIGNATURE_LIMIT }]),
  ]);

  // Holdings: sum per mint (a wallet can hold the same mint in two accounts).
  const amounts = new Map<string, number>();
  for (const acc of [...accountsA.value, ...accountsB.value]) {
    const info = acc.account.data.parsed.info;
    amounts.set(info.mint, (amounts.get(info.mint) ?? 0) + (info.tokenAmount.uiAmount ?? 0));
  }
  const holdings: Holding[] = [];
  for (const [mint, amount] of amounts) {
    const t = tokens.get(mint);
    if (!t || amount <= 0) continue;
    const s = snaps.get(mint);
    const price = s?.usd_price ?? null;
    const reference = s?.ref_price ?? null;
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
    });
  }
  holdings.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

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
    for (const [mint, delta] of deltas) {
      const t = tokens.get(mint);
      if (!t || Math.abs(delta) < 1e-9) continue;
      const paid = Math.abs(usdcDelta) > 1e-6 ? Math.abs(usdcDelta) : null;
      const kind: ActivityKind = delta > 0 ? (usdcDelta < 0 ? "bought" : "received") : usdcDelta > 0 ? "sold" : "sent";
      activity.push({
        signature,
        ts: (tx.blockTime ?? 0) * 1000,
        kind,
        mint,
        symbol: t.symbol,
        name: t.name,
        underlying: t.underlying,
        logo: t.logo ?? null,
        amount: Math.abs(delta),
        usd: paid,
        feeSol: tx.meta.fee / 1e9,
      });
    }
  }
  activity.sort((a, b) => b.ts - a.ts);

  const data: WalletData = {
    owner,
    generatedAt: new Date().toISOString(),
    sol: lamports.value / 1e9,
    usdc: amounts.get(USDC_MINT) ?? 0,
    totalValue: holdings.reduce((sum, h) => sum + (h.value ?? 0), 0),
    holdings,
    activity,
  };
  cache.set(owner, { ts: Date.now(), data });
  return data;
}
