// The dot globe as Satori-friendly markup for share images: absolutely
// positioned dots inside a disc, a glowing session ring around it and the
// New York marker. Server-only (used by the opengraph-image routes).

import { globeDots, project } from "@/lib/globe-dots";
import { BLUE } from "@/lib/brand";

const NEW_YORK = { lon: -74.006, lat: 40.7128 };

type Props = { size: number; left: number; top: number; dots?: number };

export function OgGlobe({ size, left, top, dots = 5000 }: Props) {
  const r = size / 2;
  const cx = left + r;
  const cy = top + r;
  // Centred a little east of New York so both Americas and the Atlantic edge
  // of Europe and Africa show; the terminator sits over the Atlantic.
  const lon0 = -60;
  const lat0 = 28;
  const points = globeDots(dots, lon0, lat0, -30);
  const ny = project(NEW_YORK.lon, NEW_YORK.lat, lon0, lat0);
  const dotSize = Math.max(3, Math.round(size / 95));

  return (
    <div style={{ position: "absolute", left, top, width: size, height: size, display: "flex" }}>
      {/* dark sphere */}
      <div style={{ position: "absolute", inset: 0, borderRadius: r, background: "#1b1c22", display: "flex" }} />
      {points.map((p, i) => {
        const alpha = p.night ? 0.55 + 0.45 * p.depth : 0.25 + 0.35 * p.depth;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: cx - left + p.x * r * 0.985 - dotSize / 2,
              top: cy - top - p.y * r * 0.985 - dotSize / 2,
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize,
              background: p.night ? `rgba(143,179,255,${alpha.toFixed(2)})` : `rgba(230,233,240,${alpha.toFixed(2)})`,
              display: "flex",
            }}
          />
        );
      })}
      {/* session ring with glow */}
      <div
        style={{
          position: "absolute",
          left: -18,
          top: -18,
          width: size + 36,
          height: size + 36,
          borderRadius: r + 18,
          border: `7px solid ${BLUE}`,
          boxShadow: "0 0 70px rgba(91,145,255,0.55)",
          display: "flex",
        }}
      />
      {ny && (
        <div
          style={{
            position: "absolute",
            left: cx - left + ny.x * r - 7,
            top: cy - top - ny.y * r - 7,
            width: 14,
            height: 14,
            borderRadius: 7,
            background: "#ffffff",
            boxShadow: "0 0 16px rgba(255,255,255,0.9)",
            display: "flex",
          }}
        />
      )}
    </div>
  );
}
