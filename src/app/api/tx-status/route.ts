// Status of one signature, read through the server's RPC (Helius with the
// fallback chain). The browser polls this after sending a transaction, so
// confirmation does not depend on the browser's own RPC access.

import type { NextRequest } from "next/server";
import { rpc } from "@/lib/wallet";

export const dynamic = "force-dynamic";

const SIG = /^[1-9A-HJ-NP-Za-km-z]{64,90}$/;

type Status = { err: unknown; confirmationStatus: "processed" | "confirmed" | "finalized" | null } | null;

export async function GET(req: NextRequest) {
  const sig = req.nextUrl.searchParams.get("sig") ?? "";
  if (!SIG.test(sig)) return Response.json({ error: "bad signature" }, { status: 400 });
  try {
    const res = await rpc<{ value: Status[] }>("getSignatureStatuses", [[sig], { searchTransactionHistory: true }]);
    const st = res.value[0];
    const status = !st ? "unknown" : st.err ? "failed" : st.confirmationStatus === "confirmed" || st.confirmationStatus === "finalized" ? "confirmed" : "pending";
    return Response.json({ status, err: st?.err ?? null }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
