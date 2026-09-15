// Preview (POST without "create") or build the creation transaction for a
// DBC curve quoted in a tokenized stock. Nothing is sent from here; the
// wallet signs and sends in the browser.

import type { NextRequest } from "next/server";
import {
  buildCreateTransaction,
  previewCurve,
  type CurveInput,
} from "@/lib/curve-builder";

export const dynamic = "force-dynamic";

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

type Body = Partial<CurveInput> & {
  create?: boolean;
  name?: string;
  symbol?: string;
  image?: string;
  uri?: string;
  payer?: string;
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  if (!BASE58.test(body.stockMint ?? ""))
    return Response.json({ error: "bad stock" }, { status: 400 });
  try {
    if (body.create) {
      if (!BASE58.test(body.payer ?? ""))
        return Response.json(
          { error: "connect a wallet first" },
          { status: 400 },
        );
      const built = await buildCreateTransaction(
        { ...body, name: body.name ?? "", symbol: body.symbol ?? "" },
        body.payer!,
      );
      return Response.json(built, { headers: { "cache-control": "no-store" } });
    }
    const preview = await previewCurve(body);
    return Response.json(preview, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
