// How much of one token a wallet holds. One RPC call; used by the order
// modal on stock pages to offer percent-of-holding presets when selling.

import type { NextRequest } from "next/server";
import { rpc } from "@/lib/wallet";

export const dynamic = "force-dynamic";

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

type RpcTokenAccount = { account: { data: { parsed: { info: { tokenAmount: { uiAmount: number | null } } } } } };

export async function GET(req: NextRequest) {
  const owner = req.nextUrl.searchParams.get("owner") ?? "";
  const mint = req.nextUrl.searchParams.get("mint") ?? "";
  if (!BASE58.test(owner) || !BASE58.test(mint)) return Response.json({ error: "bad request" }, { status: 400 });
  try {
    const res = await rpc<{ value: RpcTokenAccount[] }>("getTokenAccountsByOwner", [owner, { mint }, { encoding: "jsonParsed" }]);
    const amount = res.value.reduce((sum, a) => sum + (a.account.data.parsed.info.tokenAmount.uiAmount ?? 0), 0);
    return Response.json({ owner, mint, amount }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
