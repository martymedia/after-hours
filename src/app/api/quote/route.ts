// Cost estimate for buying a token with USDC at a given size, or for selling
// a number of shares back to USDC. Wraps a real Jupiter quote so the number
// includes price impact for that size.

import type { NextRequest } from "next/server";
import { getPrices, getQuote, USDC_MINT } from "@/lib/jupiter";
import { getDb } from "@/lib/db";
import type { CostEstimate } from "@/lib/stock-types";

export const dynamic = "force-dynamic";

const MIN_USD = 1;
const MAX_USD = 250_000;

export async function GET(req: NextRequest) {
  const mint = req.nextUrl.searchParams.get("mint") ?? "";
  const side = req.nextUrl.searchParams.get("side") === "sell" ? "sell" : "buy";
  const usd = Number(req.nextUrl.searchParams.get("usd") ?? "0");
  const sharesIn = Number(req.nextUrl.searchParams.get("shares") ?? "0");
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) return Response.json({ error: "bad request" }, { status: 400 });
  if (side === "buy" && (!Number.isFinite(usd) || usd < MIN_USD || usd > MAX_USD)) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  if (side === "sell" && (!Number.isFinite(sharesIn) || sharesIn <= 0)) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const token = getDb().prepare("SELECT decimals FROM tokens WHERE mint = ? AND active = 1").get(mint) as
    | { decimals: number }
    | undefined;
  if (!token) return Response.json({ error: "unknown token" }, { status: 404 });

  const prices = await getPrices([mint]);
  const price = prices[mint];
  const multiplier = price?.scaledUiConfig?.multiplier ?? 1;
  const quote =
    side === "buy"
      ? await getQuote({ inputMint: USDC_MINT, outputMint: mint, amount: BigInt(Math.round(usd * 1_000_000)) })
      : await getQuote({ inputMint: mint, outputMint: USDC_MINT, amount: BigInt(Math.round((sharesIn / multiplier) * 10 ** token.decimals)) });
  if (!quote) {
    return Response.json({ error: "no route" }, { status: 422 });
  }
  const shares = side === "buy" ? (Number(quote.outAmount) / 10 ** token.decimals) * multiplier : sharesIn;
  const usdOut = side === "buy" ? usd : Number(quote.outAmount) / 1_000_000;
  const execPrice = usdOut / shares;
  const reference = price?.stockData?.price ?? null;
  const estimate: CostEstimate = {
    side,
    usd: usdOut,
    shares,
    execPrice,
    onchainPrice: price?.usdPrice ?? null,
    reference,
    vsReferencePct: reference ? (execPrice / reference - 1) * 100 : null,
    impactPct: Number(quote.priceImpactPct) * 100,
    route: [...new Set(quote.routePlan.map((r) => r.swapInfo.label))],
  };
  return Response.json(estimate, { headers: { "cache-control": "no-store" } });
}
