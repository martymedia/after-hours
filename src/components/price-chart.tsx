"use client";

// Dark chart panel: white line with a soft area, closed-market hours shaded,
// a dashed reference line, a range control, and a hover readout with the
// exact time and price.

import { Seg } from "./motion";
import { useState } from "react";
import { getPhase } from "@/lib/market-phase";
import { formatUsd } from "@/lib/format";

type Candle = { ts: number; close: number };

type Props = {
  candles: Candle[];
  reference: number | null;
  referenceLabel: string;
  now: number;
  symbol: string;
};

type Range = "24h" | "7d";

const W = 800;
const H = 260;
const PAD = { top: 20, right: 70, bottom: 30, left: 10 };

const dayLabel = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" });
const hourLabel = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric" });
const hourOfDay = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false });
const hoverLabel = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function PriceChart({ candles, reference, referenceLabel, now, symbol }: Props) {
  const [range, setRange] = useState<Range>("7d");
  const [hover, setHover] = useState<Candle | null>(null);

  const spanMs = range === "24h" ? 24 * 3600_000 : 7 * 86400_000;
  const from = now - spanMs;
  const to = now;
  const visible = candles.filter((c) => c.ts >= from);

  return (
    <section className="card-dark p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Onchain price</h2>
          <p className="text-on-dark-muted text-xs">
            {symbol} on Solana. <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue/35 align-middle" /> After hours: Wall Street closed, onchain open. Hover for details.
          </p>
        </div>
        <Seg
          ariaLabel="Range"
          value={range}
          onChange={setRange}
          options={[
            { id: "24h", label: "24h" },
            { id: "7d", label: "7d" },
          ]}
        />
      </div>
      {visible.length < 2 ? (
        <div className="text-on-dark-muted flex h-52 items-center justify-center text-sm">
          Price history is still loading. Check back in a few minutes.
        </div>
      ) : (
        <Chart visible={visible} from={from} to={to} reference={reference} referenceLabel={referenceLabel} hover={hover} setHover={setHover} range={range} />
      )}
    </section>
  );
}

function Chart({
  visible,
  from,
  to,
  reference,
  referenceLabel,
  hover,
  setHover,
  range,
}: {
  visible: Candle[];
  from: number;
  to: number;
  reference: number | null;
  referenceLabel: string;
  hover: Candle | null;
  setHover: (c: Candle | null) => void;
  range: Range;
}) {
  const values = visible.map((c) => c.close);
  const lo = Math.min(...values, reference ?? Infinity);
  const hi = Math.max(...values, reference ?? -Infinity);
  const span = hi - lo || hi * 0.01 || 1;
  const yMin = lo - span * 0.1;
  const yMax = hi + span * 0.1;

  const x = (ts: number) => PAD.left + ((ts - from) / (to - from)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);

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

  const ticks: { ts: number; label: string }[] = [];
  const step = range === "24h" ? 6 * 3600_000 : 3600_000;
  for (let ts = from; ts <= to; ts += step) {
    const d = new Date(ts);
    if (range === "24h") {
      ticks.push({ ts, label: hourLabel.format(d) });
    } else {
      const h = hourOfDay.format(d);
      if (h === "0" || h === "00" || h === "24") ticks.push({ ts, label: dayLabel.format(d) });
    }
  }

  const linePts = visible.map((c) => `${x(c.ts).toFixed(1)},${y(c.close).toFixed(1)}`);
  const path = `M${linePts.join(" L")}`;
  const area = `M${x(visible[0].ts).toFixed(1)},${H - PAD.bottom} L${linePts.join(" L")} L${x(visible[visible.length - 1].ts).toFixed(1)},${H - PAD.bottom} Z`;

  function pick(target: SVGSVGElement, clientX: number) {
    const rect = target.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    const ts = from + ((px - PAD.left) / (W - PAD.left - PAD.right)) * (to - from);
    let best = visible[0];
    for (const c of visible) if (Math.abs(c.ts - ts) < Math.abs(best.ts - ts)) best = c;
    setHover(best);
  }
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => pick(e.currentTarget, e.clientX);
  // Touch: a finger on the chart reads the nearest hour and the readout
  // stays after lifting, so phones get the same information as a hover.
  const onTouch = (e: React.TouchEvent<SVGSVGElement>) => {
    const t = e.touches[0];
    if (t) pick(e.currentTarget, t.clientX);
  };

  const hoverLeft = hover ? x(hover.ts) > W * 0.68 : false;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full cursor-crosshair touch-pan-y"
      role="img"
      aria-label="Price chart"
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
      onTouchStart={onTouch}
      onTouchMove={onTouch}
    >
      <defs>
        <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {bands.map((b) => (
        <rect
          key={b.start}
          x={x(b.start)}
          y={PAD.top}
          width={Math.max(0, x(b.end) - x(b.start))}
          height={H - PAD.top - PAD.bottom}
          fill="var(--blue)"
          opacity="0.16"
        />
      ))}
      {bands.map((b) => (
        <text key={`l${b.start}`} x={x(b.start) + 6} y={PAD.top + 12} fontSize="10" fill="var(--blue-light)">
          {x(b.end) - x(b.start) > 60 ? "after hours" : ""}
        </text>
      ))}
      {ticks.map((t) => (
        <g key={t.ts}>
          <line x1={x(t.ts)} x2={x(t.ts)} y1={PAD.top} y2={H - PAD.bottom} stroke="#ffffff" opacity="0.08" />
          <text x={x(t.ts) + 4} y={H - 10} fontSize="11" fill="var(--on-dark-muted)">
            {t.label}
          </text>
        </g>
      ))}
      {reference != null && (
        <g>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(reference)} y2={y(reference)} stroke="var(--blue)" strokeWidth="1" strokeDasharray="4 4" opacity="0.9" />
          <text x={W - PAD.right + 8} y={y(reference) + 4} fontSize="11" fill="var(--blue-light)">
            {formatUsd(reference)}
          </text>
          <text x={W - PAD.right + 8} y={y(reference) + 16} fontSize="10" fill="var(--on-dark-muted)">
            {referenceLabel}
          </text>
        </g>
      )}
      <path d={area} fill="url(#area)" />
      <path d={path} fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinejoin="round" />
      {hover && (
        <g>
          <line x1={x(hover.ts)} x2={x(hover.ts)} y1={PAD.top} y2={H - PAD.bottom} stroke="#ffffff" opacity="0.5" />
          <circle cx={x(hover.ts)} cy={y(hover.close)} r="4.5" fill="#ffffff" />
          <circle cx={x(hover.ts)} cy={y(hover.close)} r="2" fill="var(--ink)" />
          <g transform={`translate(${hoverLeft ? x(hover.ts) - 154 : x(hover.ts) + 10}, ${PAD.top})`}>
            <rect width="146" height="40" rx="12" fill="#ffffff" />
            <text x="10" y="16" fontSize="11" fill="var(--muted)">
              {hoverLabel.format(new Date(hover.ts))} ET
            </text>
            <text x="10" y="31" fontSize="13" fontWeight="600" fill="var(--ink)">
              {formatUsd(hover.close)}
            </text>
          </g>
        </g>
      )}
    </svg>
  );
}
