// Builds an unsigned Jupiter swap transaction (USDC -> stock token) for the
// user's wallet. The browser signs and sends it; this server never holds keys.

import type { NextRequest } from "next/server";
import { getQuote, USDC_MINT } from "@/lib/jupiter";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const LITE = "https://lite-api.jup.ag";
const MIN_USD = 1;
const MAX_USD = 250_000;
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

type Body = { mint?: string; usd?: number; userPublicKey?: string };

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const mint = body.mint ?? "";
  const usd = Number(body.usd ?? 0);
  const userPublicKey = body.userPublicKey ?? "";
  if (!BASE58.test(mint) || !BASE58.test(userPublicKey) || !Number.isFinite(usd) || usd < MIN_USD || usd > MAX_USD) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const token = getDb().prepare("SELECT decimals FROM tokens WHERE mint = ? AND active = 1").get(mint) as
    | { decimals: number }
    | undefined;
  if (!token) return Response.json({ error: "unknown token" }, { status: 404 });

  const feeBps = Number(process.env.PLATFORM_FEE_BPS ?? 0) || 0;
  const feeAccount = process.env.PLATFORM_FEE_ACCOUNT || "";
  const chargeFee = feeBps > 0 && BASE58.test(feeAccount);

  const quote = await getQuote({
    inputMint: USDC_MINT,
    outputMint: mint,
    amount: BigInt(Math.round(usd * 1_000_000)),
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
      outAmount: quote.outAmount,
      decimals: token.decimals,
      priceImpactPct: Number(quote.priceImpactPct) * 100,
      feeBps: chargeFee ? feeBps : 0,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
