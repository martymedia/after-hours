// Every token balance of one wallet, by mint. The Curves pages use it to
// mark the tokens the visitor already holds.
//   GET ?owner=<address>

import type { NextRequest } from "next/server";
import { allBalances } from "@/lib/wallet";

export const dynamic = "force-dynamic";

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function GET(req: NextRequest) {
  const owner = req.nextUrl.searchParams.get("owner") ?? "";
  if (!BASE58.test(owner))
    return Response.json({ error: "bad owner" }, { status: 400 });
  try {
    return Response.json(
      { amounts: await allBalances(owner) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
