// Off-chain metadata for a token launched through our curve builder, at a
// short path: the mint stores this URL, and every byte of it travels in the
// creation transaction, which has 1232 bytes for everything.
//   GET /t/<first characters of the mint>

import { SITE_URL } from "@/lib/brand";
import { findMeta } from "@/lib/db";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };
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

export function tokenMetadata(m: Stored): Record<string, unknown> {
  const ext = (m.image?.split("?")[0].split(".").pop() ?? "").toLowerCase();
  return {
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
  };
}

export async function GET(_req: Request, { params }: Props) {
  const { id } = await params;
  const raw = findMeta(`curve_token:${id.replace(/\.json$/i, "")}`);
  if (!raw) return Response.json({ error: "unknown token" }, { status: 404 });
  return Response.json(tokenMetadata(JSON.parse(raw) as Stored), {
    headers: {
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
    },
  });
}
