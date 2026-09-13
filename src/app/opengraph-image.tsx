import { ImageResponse } from "next/og";
import { BLUE, DESCRIPTION, INK, MOON_PATHS, TAGLINE } from "@/lib/brand";
import { outfitFonts } from "@/lib/og-font";

export const alt = "After Hours. Trade stocks when Wall Street sleeps.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Share card for the site: mark, wordmark, tagline, and a glowing session ring. */
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
        {/* session ring, right side */}
        <div
          style={{
            position: "absolute",
            right: -140,
            top: 75,
            width: 480,
            height: 480,
            borderRadius: 240,
            border: `10px solid ${BLUE}`,
            boxShadow: `0 0 90px rgba(91,145,255,0.55)`,
            display: "flex",
          }}
        />
        <div style={{ position: "absolute", right: 96, top: 100, width: 28, height: 28, borderRadius: 14, background: "#ffffff", display: "flex" }} />

        <div style={{ display: "flex", flexDirection: "column", padding: "72px 80px", width: 820 }}>
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
          <div style={{ display: "flex", marginTop: 72, fontSize: 68, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>{TAGLINE}</div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 27, lineHeight: 1.35, color: "#9a9ea8", fontWeight: 400 }}>{DESCRIPTION}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: "auto", fontSize: 24, color: "#9a9ea8" }}>
            <div style={{ width: 12, height: 12, borderRadius: 6, background: BLUE, display: "flex" }} />
            <span>after-hour.net</span>
            <span style={{ color: "#5b6070" }}>·</span>
            <span>Tokenized stocks on Solana, 24/7</span>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
