// Builds an unsigned Jupiter swap transaction (USDC -> stock token, or stock
// token -> USDC when selling) for the user's wallet. The browser signs and
// sends it; this server never holds keys.

import type { NextRequest } from "next/server";
import { getPrices, getQuote, USDC_MINT } from "@/lib/jupiter";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const LITE = "https://lite-api.jup.ag";
const MIN_USD = 1;
const MAX_USD = 250_000;
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

type Body = { mint?: string; usd?: number; side?: "buy" | "sell"; shares?: number; userPublicKey?: string };

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const mint = body.mint ?? "";
  const side = body.side === "sell" ? "sell" : "buy";
  const usd = Number(body.usd ?? 0);
  const shares = Number(body.shares ?? 0);
  const userPublicKey = body.userPublicKey ?? "";
  if (!BASE58.test(mint) || !BASE58.test(userPublicKey)) return Response.json({ error: "bad request" }, { status: 400 });
  if (side === "buy" && (!Number.isFinite(usd) || usd < MIN_USD || usd > MAX_USD)) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  if (side === "sell" && (!Number.isFinite(shares) || shares <= 0)) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const token = getDb().prepare("SELECT decimals FROM tokens WHERE mint = ? AND active = 1").get(mint) as
    | { decimals: number }
    | undefined;
  if (!token) return Response.json({ error: "unknown token" }, { status: 404 });

  const feeBps = Number(process.env.PLATFORM_FEE_BPS ?? 0) || 0;
  const feeAccount = process.env.PLATFORM_FEE_ACCOUNT || "";
  const chargeFee = feeBps > 0 && BASE58.test(feeAccount);

  let amount: bigint;
  if (side === "buy") {
    amount = BigInt(Math.round(usd * 1_000_000));
  } else {
    const multiplier = (await getPrices([mint]))[mint]?.scaledUiConfig?.multiplier ?? 1;
    amount = BigInt(Math.round((shares / multiplier) * 10 ** token.decimals));
  }
  const quote = await getQuote({
    inputMint: side === "buy" ? USDC_MINT : mint,
    outputMint: side === "buy" ? mint : USDC_MINT,
    amount,
    slippageBps: 50,
    platformFeeBps: chargeFee ? feeBps : undefined,
  });
  if (!quote) return Response.json({ error: "no route" }, { status: 422 });

  const swapRes = await fetch(`${LITE}/swap/v1/swap`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      dynamicSlippage: true,
      prioritizationFeeLamports: {
        priorityLevelWithMaxLamports: { maxLamports: 2_000_000, priorityLevel: "high" },
      },
      ...(chargeFee ? { feeAccount } : {}),
    }),
  });
  const swap = (await swapRes.json()) as {
    swapTransaction?: string;
    lastValidBlockHeight?: number;
    simulationError?: unknown;
    error?: string;
  };
  if (!swapRes.ok || !swap.swapTransaction) {
    return Response.json({ error: swap.error ?? "swap build failed" }, { status: 502 });
  }
  return Response.json(
    {
      swapTransaction: swap.swapTransaction,
      lastValidBlockHeight: swap.lastValidBlockHeight,
      side,
      outAmount: quote.outAmount,
      decimals: side === "buy" ? token.decimals : 6,
      priceImpactPct: Number(quote.priceImpactPct) * 100,
      feeBps: chargeFee ? feeBps : 0,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
