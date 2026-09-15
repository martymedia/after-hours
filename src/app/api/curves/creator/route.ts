// Curves a wallet created, with the creator fees waiting on each.
//   GET ?owner=<address>

import type { NextRequest } from "next/server";
import { creatorCurves } from "@/lib/curve-trade";

export const dynamic = "force-dynamic";

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function GET(req: NextRequest) {
  const owner = req.nextUrl.searchParams.get("owner") ?? "";
  if (!BASE58.test(owner))
    return Response.json({ error: "bad owner" }, { status: 400 });
  try {
    return Response.json(
      { pools: await creatorCurves(owner) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
