// Open limit orders of a wallet, joined with our token list so the page can
// say "Buy 0.09 DRAM at 55.00" instead of raw mint amounts.

import type { NextRequest } from "next/server";
import { listTokens } from "@/lib/db";
import { USDC_MINT } from "@/lib/jupiter";
import { listTriggerOrders } from "@/lib/trigger";

export const dynamic = "force-dynamic";

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export type OpenOrder = {
  order: string;
  side: "buy" | "sell";
  mint: string;
  symbol: string;
  name: string;
  underlying: string;
  logo: string | null;
  usd: number;
  shares: number;
  /** USD per share the order fills at. */
  price: number;
  /** Fraction of the order still open, 0..1. */
  remaining: number;
  expiresAt: number | null;
  createdAt: number | null;
};

export async function GET(req: NextRequest) {
  const owner = req.nextUrl.searchParams.get("owner") ?? "";
  if (!BASE58.test(owner)) return Response.json({ error: "invalid owner" }, { status: 400 });
  try {
    const tokens = new Map(listTokens().map((t) => [t.mint, t]));
    const raw = await listTriggerOrders(owner, "active");
    const orders: OpenOrder[] = [];
    for (const o of raw) {
      const buy = o.inputMint === USDC_MINT && tokens.has(o.outputMint);
      const sell = o.outputMint === USDC_MINT && tokens.has(o.inputMint);
      if (!buy && !sell) continue;
      const t = tokens.get(buy ? o.outputMint : o.inputMint)!;
      // Jupiter returns UI amounts in makingAmount/takingAmount and raw units
      // in rawMakingAmount/rawTakingAmount; prefer raw when present.
      const making = o.rawMakingAmount != null ? Number(o.rawMakingAmount) / 10 ** (buy ? 6 : t.decimals) : Number(o.makingAmount);
      const taking = o.rawTakingAmount != null ? Number(o.rawTakingAmount) / 10 ** (buy ? t.decimals : 6) : Number(o.takingAmount);
      const usd = buy ? making : taking;
      const shares = buy ? taking : making;
      const remainingMaking = o.remainingMakingAmount != null ? Number(o.remainingMakingAmount) : making;
      const expires = o.expiredAt == null ? null : Number(o.expiredAt) * (String(o.expiredAt).length > 11 ? 1 : 1000);
      orders.push({
        order: o.orderKey ?? o.publicKey ?? "",
        side: buy ? "buy" : "sell",
        mint: t.mint,
        symbol: t.symbol,
        name: t.name,
        underlying: t.underlying,
        logo: t.logo ?? null,
        usd,
        shares,
        price: shares > 0 ? usd / shares : 0,
        remaining: making > 0 ? Math.max(0, Math.min(1, remainingMaking / making)) : 1,
        expiresAt: Number.isFinite(expires) ? expires : null,
        createdAt: o.createdAt ? Date.parse(o.createdAt) || null : null,
      });
    }
    return Response.json({ owner, orders }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
