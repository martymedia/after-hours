// The dot globe as one inline SVG for share images: hundreds of dots are one
// node for the layout engine instead of hundreds of absolutely positioned
// divs, which is what made the cards slow. A glowing session ring and the
// New York marker are drawn into the same SVG. Server-only.

import { globeDots, project } from "@/lib/globe-dots";
import { BLUE } from "@/lib/brand";

const NEW_YORK = { lon: -74.006, lat: 40.7128 };

type Props = { size: number; left: number; top: number; dots?: number };

export function OgGlobe({ size, left, top, dots = 5000 }: Props) {
  const pad = 60; // room for the ring glow
  const r = size / 2;
  const c = pad + r;
  const lon0 = -60;
  const lat0 = 28;
  const points = globeDots(dots, lon0, lat0, -30);
  const ny = project(NEW_YORK.lon, NEW_YORK.lat, lon0, lat0);
  const dotR = Math.max(1.6, size / 190);
  const box = size + pad * 2;

  return (
    <div style={{ position: "absolute", left: left - pad, top: top - pad, width: box, height: box, display: "flex" }}>
      <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`}>
        {/* glow: soft rings behind the session ring */}
        <circle cx={c} cy={c} r={r + 18} fill="none" stroke={BLUE} strokeOpacity="0.10" strokeWidth="44" />
        <circle cx={c} cy={c} r={r + 18} fill="none" stroke={BLUE} strokeOpacity="0.18" strokeWidth="24" />
        {/* sphere */}
        <circle cx={c} cy={c} r={r} fill="#1b1c22" />
        {points.map((p, i) => {
          const alpha = p.night ? 0.55 + 0.45 * p.depth : 0.25 + 0.35 * p.depth;
          return (
            <circle
              key={i}
              cx={c + p.x * r * 0.985}
              cy={c - p.y * r * 0.985}
              r={dotR}
              fill={p.night ? "#8fb3ff" : "#e6e9f0"}
              fillOpacity={alpha.toFixed(2)}
            />
          );
        })}
        {/* session ring */}
        <circle cx={c} cy={c} r={r + 18} fill="none" stroke={BLUE} strokeWidth="7" />
        {ny && (
          <g>
            <circle cx={c + ny.x * r} cy={c - ny.y * r} r="12" fill="#ffffff" fillOpacity="0.35" />
            <circle cx={c + ny.x * r} cy={c - ny.y * r} r="7" fill="#ffffff" />
          </g>
        )}
      </svg>
    </div>
  );
}
