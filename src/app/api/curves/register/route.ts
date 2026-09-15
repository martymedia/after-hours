// Put a freshly created curve into our tables right away instead of
// waiting for the next full scan.
//   POST { pool, name?, symbol? }

import type { NextRequest } from "next/server";
import { registerCurve } from "@/lib/dbc";

export const dynamic = "force-dynamic";

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function POST(req: NextRequest) {
  let body: { pool?: string; name?: string; symbol?: string; image?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  if (!BASE58.test(body.pool ?? ""))
    return Response.json({ error: "bad pool" }, { status: 400 });
  try {
    const name = (body.name ?? "").trim().slice(0, 32) || null;
    const symbol = (body.symbol ?? "").trim().slice(0, 10) || null;
    const raw = (body.image ?? "").trim().slice(0, 300);
    const image = /^https:\/\/\S+$/i.test(raw) ? raw : null;
    return Response.json(
      await registerCurve(body.pool!, { name, symbol, image }),
      {
        headers: { "cache-control": "no-store" },
      },
    );
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
