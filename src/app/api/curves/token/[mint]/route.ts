// Off-chain metadata for a token launched through our curve builder. The
// mint stores this URL, and wallets and indexers read the icon from here.
// Written when the creation transaction is built, keyed by the mint.
//   GET /api/curves/token/<mint>

import { SITE_URL } from "@/lib/brand";
import { getMeta } from "@/lib/db";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ mint: string }> };
type Stored = {
  name: string;
  symbol: string;
  image: string | null;
  quote?: string;
};

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

export async function GET(_req: Request, { params }: Props) {
  const { mint } = await params;
  const raw = getMeta(`curve_token:${mint.replace(/\.json$/i, "")}`);
  if (!raw) return Response.json({ error: "unknown token" }, { status: 404 });
  const m = JSON.parse(raw) as Stored;
  const ext = (m.image?.split("?")[0].split(".").pop() ?? "").toLowerCase();
  return Response.json(
    {
      name: m.name,
      symbol: m.symbol,
      description: `${m.name} is sold along a bonding curve priced in ${m.quote ?? "a tokenized stock"}, launched on After Hours.`,
      image: m.image ?? undefined,
      external_url: `${SITE_URL}/curves`,
      ...(m.image
        ? {
            properties: {
              category: "image",
              files: [{ uri: m.image, type: MIME[ext] ?? "image/png" }],
            },
          }
        : {}),
    },
    {
      headers: {
        "cache-control": "public, max-age=300",
        "access-control-allow-origin": "*",
      },
    },
  );
}
