// Outfit for the generated images. Google Fonts hands out TrueType files to
// clients without a browser user agent, which is what Satori can read. Cached for the process;
// images fall back to the built-in font when the network is not there.

type Font = { name: string; data: ArrayBuffer; weight: 400 | 600 | 700; style: "normal" };

const cache = new Map<number, Promise<ArrayBuffer | null>>();

async function fetchWeight(weight: 400 | 600 | 700): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(`https://fonts.googleapis.com/css2?family=Outfit:wght@${weight}`, {
      headers: { "user-agent": "curl/8.0" },
      signal: AbortSignal.timeout(8000),
    }).then((r) => r.text());
    const url = css.match(/url\((https:\/\/fonts\.gstatic\.com[^)]+\.(?:ttf|otf))\)/)?.[1];
    if (!url) return null;
    return await fetch(url, { signal: AbortSignal.timeout(8000) }).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

export async function outfitFonts(): Promise<Font[]> {
  const weights: (400 | 600 | 700)[] = [400, 600, 700];
  const fonts: Font[] = [];
  for (const weight of weights) {
    if (!cache.has(weight)) cache.set(weight, fetchWeight(weight));
    const data = await cache.get(weight)!;
    if (data) fonts.push({ name: "Outfit", data, weight, style: "normal" });
  }
  return fonts;
}
