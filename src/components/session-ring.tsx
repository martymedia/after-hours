"use client";

// A 24-hour clock ring drawn around the globe. White arc: Wall Street's
// regular session (9:30 to 16:00 New York). Blue arc: after hours, when the
// onchain market is the only one open. A dot marks the time right now.

import { nyParts } from "@/lib/market-phase";

const OPEN_MIN = 9 * 60 + 30;
const CLOSE_MIN = 16 * 60;

function angleAt(minutes: number): number {
  return (minutes / 1440) * 360 - 90;
}

function point(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function arc(cx: number, cy: number, r: number, fromMin: number, toMin: number): string {
  const [sx, sy] = point(cx, cy, r, angleAt(fromMin));
  const [ex, ey] = point(cx, cy, r, angleAt(toMin));
  const large = toMin - fromMin > 720 ? 1 : 0;
  return `M${sx.toFixed(2)},${sy.toFixed(2)} A${r},${r} 0 ${large} 1 ${ex.toFixed(2)},${ey.toFixed(2)}`;
}

export function SessionRing({ now, tradingDay }: { now: number; tradingDay: boolean }) {
  const size = 100;
  const c = size / 2;
  const r = 46;
  const minutes = nyParts(new Date(now)).minutes;
  const [mx, my] = point(c, c, r, angleAt(minutes));
  const [ox, oy] = point(c, c, r + 3.5, angleAt(OPEN_MIN));
  const [cx2, cy2] = point(c, c, r + 3.5, angleAt(CLOSE_MIN));

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      <circle cx={c} cy={c} r={r} fill="none" stroke="#ffffff" strokeOpacity="0.08" strokeWidth="1.2" />
      {/* after hours: close -> midnight -> open */}
      <path d={arc(c, c, r, CLOSE_MIN, 1440)} fill="none" stroke="var(--blue)" strokeWidth="1.6" strokeLinecap="round" />
      <path d={arc(c, c, r, 0, OPEN_MIN)} fill="none" stroke="var(--blue)" strokeWidth="1.6" strokeLinecap="round" />
      {/* regular session */}
      <path
        d={arc(c, c, r, OPEN_MIN, CLOSE_MIN)}
        fill="none"
        stroke="#ffffff"
        strokeOpacity={tradingDay ? 0.7 : 0.25}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <text x={ox} y={oy} fontSize="2.6" fill="#ffffff" fillOpacity="0.6" textAnchor="middle" dominantBaseline="middle">
        9:30
      </text>
      <text x={cx2} y={cy2} fontSize="2.6" fill="#ffffff" fillOpacity="0.6" textAnchor="middle" dominantBaseline="middle">
        16:00
      </text>
      <circle cx={mx} cy={my} r="2.2" fill="#ffffff" />
      <circle cx={mx} cy={my} r="1" fill="var(--ink)" />
    </svg>
  );
}
