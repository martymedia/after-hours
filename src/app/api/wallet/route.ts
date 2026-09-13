import { getWallet } from "@/lib/wallet";

export const dynamic = "force-dynamic";

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** GET /api/wallet?owner=<address>: holdings and recent activity of a wallet. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const owner = url.searchParams.get("owner") ?? "";
  const fresh = url.searchParams.get("fresh") === "1";
  if (!BASE58.test(owner)) return Response.json({ error: "invalid owner" }, { status: 400 });
  try {
    const data = await getWallet(owner, fresh);
    return Response.json(data, { headers: { "cache-control": fresh ? "no-store" : "private, max-age=30" } });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
