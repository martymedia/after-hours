// The favicon of a news source, served by us.
//   GET /api/icon/<hostname>
//
// The point of the round trip is that the reader's browser only ever talks
// to after-hour.net. We ask a public icon service once per host, keep the
// bytes, and hand out the same image afterwards. When there is no icon, or
// the service is down, the answer is a letter drawn in the source's own
// colour, so the page never shows a broken image and never has to run any
// JavaScript to recover.

import { safeHost, siteName, slotOf, PALETTE } from "@/lib/source-look";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ host: string }> };

const SERVICE = "https://icons.duckduckgo.com/ip3";
const TTL_MS = 7 * 24 * 3_600_000;
const MAX_BYTES = 120_000;
const MAX_ENTRIES = 400;
const DAY = 86_400;

type Icon = { ts: number; body: ArrayBuffer | string; type: string };
const cache = new Map<string, Icon>();

/** The letter, in the source's colour, as a picture. Always succeeds. */
function monogram(host: string): Icon {
  const name = siteName(host);
  const { ink } = PALETTE[slotOf(name)];
  const letter = (name.slice(0, 1).toUpperCase() || "?").replace(/[<&>]/g, "");
  const body =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">` +
    `<text x="16" y="17" fill="${ink}" font-family="system-ui,sans-serif" font-size="20" ` +
    `font-weight="600" text-anchor="middle" dominant-baseline="central">${letter}</text>` +
    `</svg>`;
  return { ts: Date.now(), body, type: "image/svg+xml" };
}

/**
 * Whether what came back is an image worth showing. A service that answers
 * with an HTML error page, or with a one-pixel nothing, would otherwise end
 * up on the page as a smudge.
 */
function usable(type: string, bytes: number): boolean {
  return type.startsWith("image/") && bytes > 120 && bytes <= MAX_BYTES;
}

async function iconFor(host: string): Promise<Icon> {
  try {
    const res = await fetch(`${SERVICE}/${host}.ico`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return monogram(host);
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    const body = await res.arrayBuffer();
    if (!usable(type, body.byteLength)) return monogram(host);
    return { ts: Date.now(), body, type };
  } catch {
    // Their service being down is not our page being down.
    return monogram(host);
  }
}

export async function GET(_req: Request, { params }: Props) {
  const raw = await params;
  const host = safeHost(decodeURIComponent(raw.host).replace(/\.(ico|png)$/i, ""));
  if (!host) return new Response("bad host", { status: 400 });

  let icon = cache.get(host);
  if (!icon || Date.now() - icon.ts > TTL_MS) {
    icon = await iconFor(host);
    // Oldest out first, so a long uptime cannot grow this without bound.
    if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
    cache.set(host, icon);
  }

  return new Response(icon.body, {
    headers: {
      "content-type": icon.type,
      // A fallback should not be cached as long as a real icon: the site may
      // grow one, or the service may simply have been unreachable.
      "cache-control": `public, max-age=${icon.type === "image/svg+xml" ? DAY : DAY * 30}`,
    },
  });
}
