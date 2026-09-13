import { ImageResponse } from "next/og";
import { BLUE, INK, MOON_PATHS } from "@/lib/brand";
import { outfitFonts } from "@/lib/og-font";
import { formatUsd } from "@/lib/format";
import { getTrade } from "@/lib/trade";
import { OgGlobe } from "@/components/og-globe";

export const alt = "A tokenized stock trade on Solana";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

const DOWN = "#e5484d";
const when = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Share card for one trade: what, how much, and how it compared to Wall Street at the time. */
export default async function TradeImage({ params }: { params: Promise<{ signature: string }> }) {
  const { signature } = await params;
  const t = await getTrade(signature);
  const fonts = await outfitFonts();
  const vs = t?.vsRefPct ?? null;
  const tone = vs == null || Math.abs(vs) < 0.25 ? "#9a9ea8" : vs < 0 ? "#8fb3ff" : DOWN;
  const verb = t?.kind === "sold" ? "Sold" : "Bought";
  const vsText = vs == null ? "" : Math.abs(vs) < 0.25 ? "in line with Wall Street" : `${Math.abs(vs).toFixed(1)}% ${vs < 0 ? "under" : "over"} Wall Street's last print`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: INK, color: "#ffffff", fontFamily: "Outfit, sans-serif", padding: "64px 80px", position: "relative", overflow: "hidden" }}>
        <OgGlobe size={420} left={930} top={230} dots={4000} />
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, color: "#9a9ea8" }}>
          <svg width="34" height="34" viewBox="0 0 40 40">
            {MOON_PATHS.map((d) => (
              <path key={d} d={d} fill="#ffffff" />
            ))}
          </svg>
          <span style={{ color: "#ffffff", fontWeight: 600 }}>After Hours</span>
          <span>·</span>
          <span>{t ? `${when.format(new Date(t.ts))} New York time` : "after-hour.net"}</span>
        </div>

        {t ? (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 56, width: 820 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <div style={{ width: 96, height: 96, borderRadius: 48, background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                {t.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.logo} width={96} height={96} alt="" style={{ objectFit: "cover", borderRadius: 48 }} />
                ) : (
                  <span style={{ color: INK, fontSize: 36, fontWeight: 700 }}>{t.underlying.slice(0, 2)}</span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontSize: 30, color: "#9a9ea8" }}>{verb}</div>
                <div style={{ display: "flex", fontSize: 56, fontWeight: 700, letterSpacing: -1.5, lineHeight: 1.05 }}>{t.name}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 20, marginTop: 44 }}>
              <div style={{ display: "flex", fontSize: 88, fontWeight: 700, letterSpacing: -3, lineHeight: 1 }}>{formatUsd(t.usd)}</div>
              <div style={{ display: "flex", fontSize: 30, color: "#9a9ea8" }}>
                for {t.amount >= 1 ? t.amount.toFixed(3) : t.amount.toFixed(4)} {t.symbol}
              </div>
            </div>
            {vsText && <div style={{ display: "flex", marginTop: 16, fontSize: 38, fontWeight: 600, color: tone }}>{vsText}</div>}
          </div>
        ) : (
          <div style={{ display: "flex", marginTop: 80, fontSize: 56, fontWeight: 700 }}>A trade on Solana</div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: "auto", fontSize: 24, color: "#9a9ea8" }}>
          <div style={{ width: 12, height: 12, borderRadius: 6, background: BLUE, display: "flex" }} />
          <span>after-hour.net</span>
          <span style={{ color: "#5b6070" }}>·</span>
          <span>Trade stocks when Wall Street sleeps</span>
        </div>
      </div>
    ),
    { ...size, ...(fonts.length ? { fonts } : {}) },
  );
}
