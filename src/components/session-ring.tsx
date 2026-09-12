"use client";

// A 24-hour clock ring drawn around the globe. White arc: Wall Street's
// regular session (9:30 AM to 4 PM New York). Blue arc: after hours, when
// the onchain market is the only one open. A dot marks the time right now.
// The two labels carry a tooltip that says what they mean.

import { nyParts } from "@/lib/market-phase";
import { Tip } from "./tip";

const OPEN_MIN = 9 * 60 + 30;
const CLOSE_MIN = 16 * 60;
const R = 46;
const C = 50;

function angleAt(minutes: number): number {
  return (minutes / 1440) * 360 - 90;
}

function point(r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [C + r * Math.cos(rad), C + r * Math.sin(rad)];
}

function arc(r: number, fromMin: number, toMin: number): string {
  const [sx, sy] = point(r, angleAt(fromMin));
  const [ex, ey] = point(r, angleAt(toMin));
  const large = toMin - fromMin > 720 ? 1 : 0;
  return `M${sx.toFixed(2)},${sy.toFixed(2)} A${r},${r} 0 ${large} 1 ${ex.toFixed(2)},${ey.toFixed(2)}`;
}

function Label({ minutes, text, tip }: { minutes: number; text: string; tip: string }) {
  const [x, y] = point(R + 6, angleAt(minutes));
  return (
    <span className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
      <Tip text={tip} underline={false} tone="light">
        <span className="num rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/80 hover:bg-white/20 sm:text-[11px]">{text}</span>
      </Tip>
    </span>
  );
}

export function SessionRing({ now, tradingDay }: { now: number; tradingDay: boolean }) {
  const minutes = nyParts(new Date(now)).minutes;
  const [mx, my] = point(R, angleAt(minutes));

  return (
    <div className="absolute inset-0">
      <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
        <defs>
          <filter id="ring-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.4" />
          </filter>
        </defs>
        <circle cx={C} cy={C} r={R} fill="none" stroke="#ffffff" strokeOpacity="0.08" strokeWidth="1.2" />
        {/* soft blue halo under the after-hours arcs */}
        <g filter="url(#ring-glow)" opacity="0.75">
          <path d={arc(R, CLOSE_MIN, 1440)} fill="none" stroke="var(--blue)" strokeWidth="3.2" strokeLinecap="round" />
          <path d={arc(R, 0, OPEN_MIN)} fill="none" stroke="var(--blue)" strokeWidth="3.2" strokeLinecap="round" />
        </g>
        <path d={arc(R, CLOSE_MIN, 1440)} fill="none" stroke="var(--blue)" strokeWidth="1.6" strokeLinecap="round" />
        <path d={arc(R, 0, OPEN_MIN)} fill="none" stroke="var(--blue)" strokeWidth="1.6" strokeLinecap="round" />
        <path
          d={arc(R, OPEN_MIN, CLOSE_MIN)}
          fill="none"
          stroke="#ffffff"
          strokeOpacity={tradingDay ? 0.7 : 0.25}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle cx={mx} cy={my} r="2.2" fill="#ffffff" />
        <circle cx={mx} cy={my} r="1" fill="var(--ink)" />
      </svg>
      <Label
        minutes={OPEN_MIN}
        text="9:30 AM"
        tip="Opening bell in New York. Wall Street's regular session starts, and onchain prices snap back to tracking the exchange."
      />
      <Label
        minutes={CLOSE_MIN}
        text="4 PM"
        tip="Closing bell. Brokerages go quiet; from here until the next open, the onchain market is where these stocks trade. After Hours begins."
      />
    </div>
  );
}
