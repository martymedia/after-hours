// One trade, read from the chain by its signature: what moved, for how much
// USDC, and how that compared to the reference price at the time. Powers the
// shareable /trade/[signature] page and its card.

import { listTokens, snapshotAt } from "./db.ts";
import { ISSUERS, type IssuerId } from "./issuers.ts";
import { USDC_MINT } from "./jupiter.ts";
import { rpc, TRIGGER_PROGRAM, type RpcTransaction } from "./wallet.ts";

export type Trade = {
  signature: string;
  ts: number;
  owner: string;
  kind: "bought" | "sold";
  /** Filled by a Jupiter Trigger limit order (the keeper signed, not the owner). */
  order?: boolean;
  mint: string;
  symbol: string;
  name: string;
  underlying: string;
  issuerName: string;
  logo: string | null;
  amount: number;
  usd: number;
  perShare: number;
  refAtTime: number | null;
  /** perShare vs refAtTime, percent. Negative: paid less than the last print. */
  vsRefPct: number | null;
};

const cache = new Map<string, { ts: number; trade: Trade | null }>();
const CACHE_MS = 10 * 60_000;

/** The tracked-token leg of a swap. `mint` picks one when a transaction moved several. */
export async function getTrade(
  signature: string,
  mint?: string,
): Promise<Trade | null> {
  const key = `${signature}|${mint ?? ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_MS) return hit.trade;

  const tokens = new Map(listTokens().map((t) => [t.mint, t]));
  let tx: RpcTransaction | null = null;
  try {
    tx = await rpc<RpcTransaction | null>("getTransaction", [
      signature,
      { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
    ]);
  } catch {
    tx = null;
  }
  if (!tx?.meta || tx.meta.err) {
    cache.set(key, { ts: Date.now(), trade: null });
    return null;
  }

  const meta = tx.meta;
  const fill = Boolean(
    tx.transaction?.message.instructions.some(
      (i) => i.programId === TRIGGER_PROGRAM,
    ),
  );
  const balances = [...tx.meta.preTokenBalances, ...tx.meta.postTokenBalances];
  // Owner: whoever holds the USDC side of the swap. For a limit-order fill the
  // owner only sees the incoming side (the order account paid), so every owner
  // in the transaction is a candidate and the largest leg wins.
  const owners = new Set<string>();
  for (const b of balances)
    if (b.owner && (fill || b.mint === USDC_MINT)) owners.add(b.owner);
  const post = new Map(
    tx.meta.postTokenBalances.map((b) => [b.accountIndex, b]),
  );
  /** Per mint, what accounts of other owners paid out (a closed account counts as emptied). */
  const paidOutBy = (owner: string): Map<string, number> => {
    const out = new Map<string, number>();
    for (const b of meta.preTokenBalances) {
      if (b.owner === owner) continue;
      const d =
        (post.get(b.accountIndex)?.uiTokenAmount.uiAmount ?? 0) -
        (b.uiTokenAmount.uiAmount ?? 0);
      if (d < 0) out.set(b.mint, (out.get(b.mint) ?? 0) - d);
    }
    return out;
  };
  let trade: Trade | null = null;
  for (const owner of owners) {
    const deltas = new Map<string, number>();
    for (const b of tx.meta.preTokenBalances)
      if (b.owner === owner)
        deltas.set(
          b.mint,
          (deltas.get(b.mint) ?? 0) - (b.uiTokenAmount.uiAmount ?? 0),
        );
    for (const b of tx.meta.postTokenBalances)
      if (b.owner === owner)
        deltas.set(
          b.mint,
          (deltas.get(b.mint) ?? 0) + (b.uiTokenAmount.uiAmount ?? 0),
        );
    const usdcDelta = deltas.get(USDC_MINT) ?? 0;
    const paidOut = fill ? paidOutBy(owner) : new Map<string, number>();
    const usdOut = paidOut.get(USDC_MINT) ?? 0;
    // Sell fill: the shares left the order account, USDC arrived in the wallet.
    if (
      fill &&
      usdcDelta > 1e-6 &&
      ![...deltas].some(([m, d]) => tokens.has(m) && Math.abs(d) > 1e-9)
    ) {
      for (const [m, amount] of paidOut) {
        const t = tokens.get(m);
        if (!t || amount < 1e-9 || (mint && m !== mint)) continue;
        if (trade && trade.usd >= usdcDelta) continue;
        const ts = (tx.blockTime ?? 0) * 1000;
        const perShare = usdcDelta / amount;
        const refAtTime = ts ? (snapshotAt(m, ts)?.ref_price ?? null) : null;
        trade = {
          signature,
          ts,
          owner,
          kind: "sold",
          order: true,
          mint: m,
          symbol: t.symbol,
          name: t.name,
          underlying: t.underlying,
          issuerName: ISSUERS[t.issuer as IssuerId]?.name ?? t.issuer,
          logo: t.logo ?? null,
          amount,
          usd: usdcDelta,
          perShare,
          refAtTime,
          vsRefPct: refAtTime ? (perShare / refAtTime - 1) * 100 : null,
        };
      }
      continue;
    }
    if (Math.abs(usdcDelta) < 1e-6 && !(fill && usdOut > 1e-6)) continue;
    for (const [m, delta] of deltas) {
      const t = tokens.get(m);
      if (!t || Math.abs(delta) < 1e-9) continue;
      if (mint && m !== mint) continue;
      const buyFill =
        fill && delta > 0 && Math.abs(usdcDelta) < 1e-6 && usdOut > 1e-6;
      // In a fill only the order side counts; the pool and the keeper move the other way.
      const kind = buyFill
        ? "bought"
        : fill
          ? null
          : delta > 0 && usdcDelta < 0
            ? "bought"
            : delta < 0 && usdcDelta > 0
              ? "sold"
              : null;
      if (!kind) continue;
      const amount = Math.abs(delta);
      // A fill: the keeper also receives a dust fee in the token; the real buyer is the largest leg.
      if (trade && trade.amount >= amount) continue;
      const usd = buyFill ? usdOut : Math.abs(usdcDelta);
      const ts = (tx.blockTime ?? 0) * 1000;
      const perShare = usd / amount;
      const refAtTime = ts ? (snapshotAt(m, ts)?.ref_price ?? null) : null;
      trade = {
        signature,
        ts,
        owner,
        kind,
        order: fill || undefined,
        mint: m,
        symbol: t.symbol,
        name: t.name,
        underlying: t.underlying,
        issuerName: ISSUERS[t.issuer as IssuerId]?.name ?? t.issuer,
        logo: t.logo ?? null,
        amount,
        usd,
        perShare,
        refAtTime,
        vsRefPct: refAtTime ? (perShare / refAtTime - 1) * 100 : null,
      };
      if (!fill) break;
    }
    if (trade && !fill) break;
  }
  cache.set(key, { ts: Date.now(), trade });
  return trade;
}
