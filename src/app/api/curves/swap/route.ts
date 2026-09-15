// Trade on a stock-quoted bonding curve, or claim creator fees.
//   POST { pool, side, amount }                  -> quote
//   POST { pool, side, amount, owner, execute }  -> unsigned swap transaction
//   POST { pool, action: "fees" }                -> creator fees outstanding
//   POST { pool, action: "claim", owner }        -> unsigned claim transaction

import type { NextRequest } from "next/server";
import {
  buildClaimCreatorFees,
  buildCurveSwap,
  creatorFees,
  quoteCurve,
} from "@/lib/curve-trade";

export const dynamic = "force-dynamic";

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

type Body = {
  pool?: string;
  side?: "buy" | "sell";
  amount?: number;
  owner?: string;
  execute?: boolean;
  action?: "fees" | "claim";
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  if (!BASE58.test(body.pool ?? ""))
    return Response.json({ error: "bad pool" }, { status: 400 });
  const pool = body.pool!;
  try {
    if (body.action === "fees")
      return Response.json(await creatorFees(pool), {
        headers: { "cache-control": "no-store" },
      });
    if (body.action === "claim") {
      if (!BASE58.test(body.owner ?? ""))
        return Response.json(
          { error: "connect a wallet first" },
          { status: 400 },
        );
      return Response.json(await buildClaimCreatorFees(pool, body.owner!), {
        headers: { "cache-control": "no-store" },
      });
    }
    const side = body.side === "sell" ? "sell" : "buy";
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0)
      return Response.json({ error: "bad amount" }, { status: 400 });
    if (body.execute) {
      if (!BASE58.test(body.owner ?? ""))
        return Response.json(
          { error: "connect a wallet first" },
          { status: 400 },
        );
      return Response.json(
        await buildCurveSwap(pool, side, amount, body.owner!),
        { headers: { "cache-control": "no-store" } },
      );
    }
    return Response.json(await quoteCurve(pool, side, amount), {
      headers: { "cache-control": "no-store" },
    });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
