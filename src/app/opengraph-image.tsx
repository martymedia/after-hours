import { ImageResponse } from "next/og";
import { BLUE, INK, MOON_PATHS, TAGLINE } from "@/lib/brand";
import { outfitFonts } from "@/lib/og-font";
import { OgGlobe } from "@/components/og-globe";

export const alt = "After Hours. Trade stocks when Wall Street sleeps.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Share card for the site: mark, wordmark, tagline, and the dot globe with its session ring. */
export default async function OpenGraphImage() {
  const fonts = await outfitFonts();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: INK,
          color: "#ffffff",
          fontFamily: "Outfit, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <OgGlobe size={470} left={690} top={80} />

        <div style={{ display: "flex", flexDirection: "column", padding: "72px 80px", width: 700 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <svg width="64" height="64" viewBox="0 0 40 40">
              {MOON_PATHS.map((d) => (
                <path key={d} d={d} fill="#ffffff" />
              ))}
            </svg>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, fontSize: 46, fontWeight: 700, letterSpacing: -1 }}>
              <span>After</span>
              <span style={{ display: "flex", background: "#ffffff", color: INK, padding: "2px 14px", borderRadius: 8, transform: "skewX(-8deg)" }}>
                <span style={{ transform: "skewX(8deg)" }}>Hours</span>
              </span>
            </div>
          </div>
          <div style={{ display: "flex", marginTop: 84, fontSize: 72, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>{TAGLINE}</div>
          <div style={{ display: "flex", marginTop: 26, fontSize: 30, lineHeight: 1.3, color: "#9a9ea8", fontWeight: 400 }}>
            Tokenized stocks on Solana, 24/7.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: "auto", fontSize: 24, color: "#9a9ea8" }}>
            <div style={{ width: 12, height: 12, borderRadius: 6, background: BLUE, display: "flex" }} />
            <span>after-hour.net</span>
          </div>
        </div>
      </div>
    ),
    { ...size, ...(fonts.length ? { fonts } : {}) },
  );
}
