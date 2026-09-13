// Builds an unsigned Jupiter limit order (USDC -> stock token, buy below a
// price) for the user's wallet, or the transaction that cancels one.

import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { getPrices, USDC_MINT } from "@/lib/jupiter";
import { cancelTriggerOrder, createTriggerOrder } from "@/lib/trigger";

export const dynamic = "force-dynamic";

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const MIN_USD = 5; // Jupiter's floor for trigger orders
const MAX_USD = 250_000;
const MAX_DAYS = 30;

type Body =
  | { action?: "create"; mint?: string; usd?: number; targetPrice?: number; days?: number; userPublicKey?: string }
  | { action: "cancel"; order?: string; userPublicKey?: string };

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const userPublicKey = body.userPublicKey ?? "";
  if (!BASE58.test(userPublicKey)) return Response.json({ error: "bad request" }, { status: 400 });

  try {
    if (body.action === "cancel") {
      if (!BASE58.test(body.order ?? "")) return Response.json({ error: "bad request" }, { status: 400 });
      const built = await cancelTriggerOrder(userPublicKey, body.order!);
      return Response.json({ transaction: built.transaction, requestId: built.requestId }, { headers: { "cache-control": "no-store" } });
    }

    const mint = body.mint ?? "";
    const usd = Number(body.usd ?? 0);
    const targetPrice = Number(body.targetPrice ?? 0);
    const days = Math.min(MAX_DAYS, Math.max(1, Math.round(Number(body.days ?? 7))));
    if (!BASE58.test(mint) || !Number.isFinite(usd) || usd < MIN_USD || usd > MAX_USD || !Number.isFinite(targetPrice) || targetPrice <= 0) {
      return Response.json({ error: "bad request" }, { status: 400 });
    }
    const token = getDb().prepare("SELECT decimals, symbol FROM tokens WHERE mint = ? AND active = 1").get(mint) as
      | { decimals: number; symbol: string }
      | undefined;
    if (!token) return Response.json({ error: "unknown token" }, { status: 404 });

    const price = (await getPrices([mint]))[mint];
    const multiplier = price?.scaledUiConfig?.multiplier ?? 1;
    const shares = usd / targetPrice;
    const takingAmount = BigInt(Math.floor((shares / multiplier) * 10 ** token.decimals));
    if (takingAmount <= 0n) return Response.json({ error: "amount too small" }, { status: 400 });

    const built = await createTriggerOrder({
      inputMint: USDC_MINT,
      outputMint: mint,
      maker: userPublicKey,
      makingAmount: BigInt(Math.round(usd * 1_000_000)),
      takingAmount,
      expiredAt: Math.floor(Date.now() / 1000) + days * 86400,
    });
    return Response.json(
      { transaction: built.transaction, order: built.order, requestId: built.requestId, shares, targetPrice, usd, days, symbol: token.symbol },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
