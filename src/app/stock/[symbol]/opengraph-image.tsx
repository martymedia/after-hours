import { ImageResponse } from "next/og";
import { BLUE, INK, MOON_PATHS } from "@/lib/brand";
import { outfitFonts } from "@/lib/og-font";
import { formatUsd, gapWords } from "@/lib/format";
import { getStock } from "@/lib/stock";

export const alt = "Tokenized stock on Solana, priced after hours";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

const DOWN = "#e5484d";

/** Share card for one stock: logo, name, onchain price and the gap to the reference. */
export default async function StockImage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const stock = getStock(symbol);
  const fonts = await outfitFonts();
  const p = stock?.primary;
  const gap = p?.gapPct ?? null;
  const words = gapWords(gap);
  const tone = gap == null || Math.abs(gap) < 0.25 ? "#9a9ea8" : gap < 0 ? "#8fb3ff" : DOWN;
  const letters = (stock?.underlying ?? symbol).slice(0, 2).toUpperCase();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: INK,
          color: "#ffffff",
          fontFamily: "Outfit, sans-serif",
          padding: "64px 80px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -180,
            bottom: -220,
            width: 560,
            height: 560,
            borderRadius: 280,
            border: `10px solid ${gap != null && gap < 0 ? BLUE : gap != null && gap > 0.25 ? DOWN : "#2f3340"}`,
            boxShadow: gap != null && gap < 0 ? "0 0 90px rgba(91,145,255,0.5)" : "none",
            display: "flex",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, color: "#9a9ea8" }}>
          <svg width="34" height="34" viewBox="0 0 40 40">
            {MOON_PATHS.map((d) => (
              <path key={d} d={d} fill="#ffffff" />
            ))}
          </svg>
          <span style={{ color: "#ffffff", fontWeight: 600 }}>After Hours</span>
          <span>·</span>
          <span>{stock ? `${stock.reference.phrase.replace(/^./, (c) => c.toUpperCase())} vs onchain` : "after-hour.net"}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: 56 }}>
          <div style={{ width: 120, height: 120, borderRadius: 60, background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {p?.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.logo} width={120} height={120} alt="" style={{ objectFit: "cover", borderRadius: 60 }} />
            ) : (
              <span style={{ color: INK, fontSize: 44, fontWeight: 700 }}>{letters}</span>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 60, fontWeight: 700, letterSpacing: -1.5, lineHeight: 1.05 }}>{stock?.name ?? symbol}</div>
            <div style={{ display: "flex", fontSize: 28, color: "#9a9ea8", marginTop: 8 }}>
              {p ? `${p.symbol} · ${p.issuerName} · Solana` : "Tokenized stock on Solana"}
            </div>
          </div>
        </div>

        {p && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginTop: 56 }}>
            <div style={{ display: "flex", fontSize: 96, fontWeight: 700, letterSpacing: -3, lineHeight: 1 }}>{formatUsd(p.price)}</div>
            <div style={{ display: "flex", fontSize: 40, fontWeight: 600, color: tone }}>
              {words === "in line" ? `in line with ${stock?.reference.phrase}` : `${words} than ${stock?.reference.phrase}`}
            </div>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: "auto", fontSize: 24, color: "#9a9ea8" }}>
          <div style={{ width: 12, height: 12, borderRadius: 6, background: BLUE, display: "flex" }} />
          <span>after-hour.net/stock/{stock?.underlying ?? symbol}</span>
          <span style={{ color: "#5b6070" }}>·</span>
          <span>Buy from your own wallet, 24/7</span>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
