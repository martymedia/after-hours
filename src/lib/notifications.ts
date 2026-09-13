// The notification sweep the collector runs once a minute:
//   1. Orders: for every wallet with a push subscription, compare Jupiter's
//      active orders with what we saw last time. Gone from active means
//      filled, cancelled or expired; the history call says which.
//   2. Price alerts: fire once when the onchain gap crosses the threshold.

import { listTokens, latestSnapshots } from "./db.ts";
import { USDC_MINT } from "./jupiter.ts";
import {
  armedAlerts,
  deleteWatchedOrder,
  firstTime,
  markAlertFired,
  subscribedOwners,
  upsertWatchedOrder,
  watchedOrders,
} from "./notify-db.ts";
import { sendPush, pushEnabled } from "./push.ts";
import { listTriggerOrders, type TriggerOrderRaw } from "./trigger.ts";
import { SITE_URL } from "./brand.ts";

type Token = {
  mint: string;
  symbol: string;
  name: string;
  underlying: string;
  decimals: number;
};

function parse(o: TriggerOrderRaw, tokens: Map<string, Token>) {
  const buy = o.inputMint === USDC_MINT && tokens.has(o.outputMint);
  const sell = o.outputMint === USDC_MINT && tokens.has(o.inputMint);
  if (!buy && !sell) return null;
  const t = tokens.get(buy ? o.outputMint : o.inputMint)!;
  const making =
    o.rawMakingAmount != null
      ? Number(o.rawMakingAmount) / 10 ** (buy ? 6 : t.decimals)
      : Number(o.makingAmount);
  const taking =
    o.rawTakingAmount != null
      ? Number(o.rawTakingAmount) / 10 ** (buy ? t.decimals : 6)
      : Number(o.takingAmount);
  const remainingMaking =
    o.remainingMakingAmount != null ? Number(o.remainingMakingAmount) : making;
  const usd = buy ? making : taking;
  const shares = buy ? taking : making;
  return {
    key: o.orderKey ?? o.publicKey ?? "",
    token: t,
    side: buy ? "buy" : "sell",
    usd,
    shares,
    price: shares > 0 ? usd / shares : 0,
    remaining:
      making > 0 ? Math.max(0, Math.min(1, remainingMaking / making)) : 1,
    status: (o.status ?? "").toLowerCase(),
  };
}

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

async function sweepOrders(
  owner: string,
  tokens: Map<string, Token>,
): Promise<void> {
  const active = (await listTriggerOrders(owner, "active"))
    .map((o) => parse(o, tokens))
    .filter((x): x is NonNullable<typeof x> => Boolean(x && x.key));
  const known = new Map(watchedOrders(owner).map((w) => [w.order_key, w]));

  for (const o of active) {
    const prev = known.get(o.key);
    if (
      prev &&
      o.remaining < prev.remaining - 0.01 &&
      o.remaining > 0.01 &&
      firstTime(`partial:${o.key}:${Math.round(o.remaining * 100)}`)
    ) {
      await sendPush(owner, {
        title: `${o.token.symbol} order partly filled`,
        body: `${Math.round((1 - o.remaining) * 100)}% of your ${money(o.usd)} order at ${money(o.price)} is done.`,
        url: `${SITE_URL}/wallet`,
        tag: `order-${o.key}`,
      });
    }
    upsertWatchedOrder({
      order_key: o.key,
      owner,
      mint: o.token.mint,
      side: o.side,
      usd: o.usd,
      shares: o.shares,
      price: o.price,
      remaining: o.remaining,
    });
    known.delete(o.key);
  }

  // Whatever is left was active last time and is gone now.
  if (known.size === 0) return;
  let history: ReturnType<typeof parse>[] = [];
  try {
    history = (await listTriggerOrders(owner, "history")).map((o) =>
      parse(o, tokens),
    );
  } catch {
    history = [];
  }
  for (const w of known.values()) {
    const h = history.find((x) => x && x.key === w.order_key);
    const status = h?.status ?? "";
    let title: string;
    let body: string;
    if (
      status.includes("ompl") ||
      status.includes("fill") ||
      (h && h.remaining <= 0.01)
    ) {
      title = `${tokens.get(w.mint)?.symbol ?? "Order"} filled`;
      body =
        w.side === "buy"
          ? `You bought about ${w.shares.toFixed(4)} ${tokens.get(w.mint)?.symbol} at ${money(w.price)}.`
          : `You sold ${w.shares.toFixed(4)} ${tokens.get(w.mint)?.symbol} at ${money(w.price)}.`;
    } else if (status.includes("ancel")) {
      title = `${tokens.get(w.mint)?.symbol ?? "Order"} order cancelled`;
      body = `${money(w.usd * w.remaining)} is back in your wallet.`;
    } else if (status.includes("xpir")) {
      title = `${tokens.get(w.mint)?.symbol ?? "Order"} order expired`;
      body = `The price never reached ${money(w.price)}. ${money(w.usd * w.remaining)} is back in your wallet.`;
    } else {
      title = `${tokens.get(w.mint)?.symbol ?? "Order"} order closed`;
      body = `Your order at ${money(w.price)} is no longer open. Check the Wallet page for details.`;
    }
    if (firstTime(`closed:${w.order_key}`)) {
      await sendPush(owner, {
        title,
        body,
        url: `${SITE_URL}/wallet`,
        tag: `order-${w.order_key}`,
      });
    }
    deleteWatchedOrder(w.order_key);
  }
}

async function sweepAlerts(tokens: Map<string, Token>): Promise<void> {
  const alerts = armedAlerts();
  if (!alerts.length) return;
  const snaps = new Map(latestSnapshots().map((s) => [s.mint, s]));
  for (const a of alerts) {
    const s = snaps.get(a.mint);
    const t = tokens.get(a.mint);
    if (!s || !t || s.usd_price == null || !s.ref_price) continue;
    const gap = (s.usd_price / s.ref_price - 1) * 100;
    const hit = a.kind === "cheaper" ? gap <= -a.threshold : gap >= a.threshold;
    if (!hit) continue;
    markAlertFired(a.id);
    await sendPush(a.owner, {
      title: `${t.symbol} is ${Math.abs(gap).toFixed(1)}% ${gap < 0 ? "cheaper" : "pricier"} than Wall Street`,
      body: `${t.name} trades at ${money(s.usd_price)} onchain against ${money(s.ref_price)}. Your alert was set at ${a.threshold}%.`,
      url: `${SITE_URL}/stock/${t.underlying}`,
      tag: `alert-${a.id}`,
    });
  }
}

export async function notificationSweep(): Promise<void> {
  if (!pushEnabled()) return;
  const tokens = new Map<string, Token>(listTokens().map((t) => [t.mint, t]));
  for (const owner of subscribedOwners()) {
    try {
      await sweepOrders(owner, tokens);
    } catch {
      // Jupiter hiccup: try again next minute.
    }
  }
  await sweepAlerts(tokens);
}
