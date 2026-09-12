"use client";

// Seven days of hourly closes. Hours where Wall Street is fully closed are
// shaded so the weekend drift is visible at a glance. A dashed line marks
// the current reference price. Hovering shows the exact time and price.

import { useState } from "react";
import { getPhase } from "@/lib/market-phase";
import { formatUsd } from "@/lib/format";

type Candle = { ts: number; close: number };

type Props = {
  candles: Candle[];
  reference: number | null;
  referenceLabel: string;
  now: number;
};

const W = 800;
const H = 240;
const PAD = { top: 16, right: 64, bottom: 28, left: 8 };

const dayLabel = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" });
const hourOfDay = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false });
const hoverLabel = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function PriceChart({ candles, reference, referenceLabel, now }: Props) {
  const [hover, setHover] = useState<Candle | null>(null);

  if (candles.length < 2) {
    return (
      <div className="border-line text-muted flex h-48 items-center justify-center rounded-lg border border-dashed text-sm">
        Price history is still loading. Check back in a few minutes.
      </div>
    );
  }
  const from = now - 7 * 86400_000;
  const to = now;
  const visible = candles.filter((c) => c.ts >= from);
  const values = visible.map((c) => c.close);
  const lo = Math.min(...values, reference ?? Infinity);
  const hi = Math.max(...values, reference ?? -Infinity);
  const span = hi - lo || hi * 0.01 || 1;
  const yMin = lo - span * 0.08;
  const yMax = hi + span * 0.08;

  const x = (ts: number) => PAD.left + ((ts - from) / (to - from)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);

  // Closed-market bands, sampled hourly.
  const bands: { start: number; end: number }[] = [];
  let open: number | null = null;
  for (let ts = from; ts <= to; ts += 3600_000) {
    const closed = getPhase(new Date(ts)).phase === "closed";
    if (closed && open == null) open = ts;
    if (!closed && open != null) {
      bands.push({ start: open, end: ts });
      open = null;
    }
  }
  if (open != null) bands.push({ start: open, end: to });

  // Day ticks at NY midnight.
  const ticks: { ts: number; label: string }[] = [];
  for (let ts = from; ts <= to; ts += 3600_000) {
    const h = hourOfDay.format(new Date(ts));
    if (h === "0" || h === "00" || h === "24") ticks.push({ ts, label: dayLabel.format(new Date(ts)) });
  }

  const path = visible
    .map((c, i) => `${i === 0 ? "M" : "L"}${x(c.ts).toFixed(1)},${y(c.close).toFixed(1)}`)
    .join(" ");

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const ts = from + ((px - PAD.left) / (W - PAD.left - PAD.right)) * (to - from);
    let best = visible[0];
    for (const c of visible) if (Math.abs(c.ts - ts) < Math.abs(best.ts - ts)) best = c;
    setHover(best);
  }

  const hoverLeft = hover ? x(hover.ts) > W * 0.7 : false;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full cursor-crosshair"
      role="img"
      aria-label="Seven day price chart"
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
    >
      {bands.map((b) => (
        <rect
          key={b.start}
          x={x(b.start)}
          y={PAD.top}
          width={Math.max(0, x(b.end) - x(b.start))}
          height={H - PAD.top - PAD.bottom}
          fill="var(--soft)"
        />
      ))}
      {ticks.map((t) => (
        <g key={t.ts}>
          <line x1={x(t.ts)} x2={x(t.ts)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--line)" strokeWidth="1" />
          <text x={x(t.ts) + 4} y={H - 10} fontSize="11" fill="var(--muted)">
            {t.label}
          </text>
        </g>
      ))}
      {reference != null && (
        <g>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(reference)}
            y2={y(reference)}
            stroke="var(--muted)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <text x={W - PAD.right + 6} y={y(reference) + 4} fontSize="11" fill="var(--muted)">
            {formatUsd(reference)}
          </text>
          <text x={W - PAD.right + 6} y={y(reference) + 16} fontSize="10" fill="var(--muted)">
            {referenceLabel}
          </text>
        </g>
      )}
      <path d={path} fill="none" stroke="var(--ink)" strokeWidth="1.75" strokeLinejoin="round" />
      {hover && (
        <g>
          <line x1={x(hover.ts)} x2={x(hover.ts)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--sol-purple)" strokeWidth="1" />
          <circle cx={x(hover.ts)} cy={y(hover.close)} r="3.5" fill="var(--sol-purple)" />
          <g transform={`translate(${hoverLeft ? x(hover.ts) - 150 : x(hover.ts) + 8}, ${PAD.top + 2})`}>
            <rect width="142" height="36" rx="4" fill="var(--ink)" />
            <text x="8" y="15" fontSize="11" fill="var(--paper)">
              {hoverLabel.format(new Date(hover.ts))} ET
            </text>
            <text x="8" y="29" fontSize="12" fontWeight="600" fill="var(--paper)">
              {formatUsd(hover.close)}
            </text>
          </g>
        </g>
      )}
    </svg>
  );
}
