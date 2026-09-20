// How a news source looks on the page. Shared by the feed and by the icon
// route, so a tile and its fallback letter always agree.

/**
 * The part of a hostname a reader would say out loud: "reuters" from
 * reuters.com, "ycombinator" from news.ycombinator.com, "bbc" from
 * bbc.co.uk. An odd domain degrades to the hostname itself.
 */
export function siteName(host: string): string {
  const parts = host.split(".").filter(Boolean);
  if (parts.length < 2) return host;
  const second = parts[parts.length - 2];
  const shared = ["co", "com", "org", "net", "ac", "gov", "edu"];
  if (parts.length > 2 && shared.includes(second))
    return parts[parts.length - 3];
  return second;
}

/**
 * A fixed palette rather than a hue off a hash: hashing into the whole
 * circle clumps badly, and six rows came out four shades of purple. `ink`
 * carries white text and draws the rail, `wash` sits behind the icon.
 */
export const PALETTE = [
  { ink: "#4f46e5", wash: "#eef0fe" },
  { ink: "#e11d48", wash: "#fdecf1" },
  { ink: "#0d9488", wash: "#e8f6f4" },
  { ink: "#ea580c", wash: "#fdefe6" },
  { ink: "#0284c7", wash: "#e7f3fb" },
  { ink: "#7c3aed", wash: "#f2ecfe" },
  { ink: "#059669", wash: "#e7f5ef" },
  { ink: "#c026d3", wash: "#fbeafd" },
  { ink: "#ca8a04", wash: "#fbf4e2" },
  { ink: "#2563eb", wash: "#eaf1fe" },
];

/** A stable slot per source, so the same site keeps the same colour. */
export function slotOf(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % PALETTE.length;
}

/**
 * A hostname we are willing to ask an icon service about. The value comes
 * from someone else's post, so it has to look like a hostname and nothing
 * else before it goes anywhere near a URL.
 */
export function safeHost(host: string): string | null {
  const h = host.trim().toLowerCase();
  if (h.length < 4 || h.length > 100) return null;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(h))
    return null;
  return h;
}
