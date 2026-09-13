import { getWallet } from "@/lib/wallet";

export const dynamic = "force-dynamic";

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** GET /api/wallet?owner=<address>: holdings and recent activity of a wallet. */
export async function GET(req: Request) {
  const owner = new URL(req.url).searchParams.get("owner") ?? "";
  if (!BASE58.test(owner)) return Response.json({ error: "invalid owner" }, { status: 400 });
  try {
    const data = await getWallet(owner);
    return Response.json(data, { headers: { "cache-control": "private, max-age=30" } });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
