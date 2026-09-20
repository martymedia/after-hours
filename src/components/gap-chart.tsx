"use client";

// Gap radar: onchain price versus the reference over the last 48 hours as
// bars around a zero line. Red above (onchain higher), blue below. Pointing
// at a bar reads out the hour it covers and what the gap was then, because
// "on average 26% over two days" hides every hour that was not average.

import { useState } from "react";
import type { GapPoint } from "@/lib/stock-types";
import { gapSentence, gapTone, gapWords } from "@/lib/format";

const W = 600;
const H = 120;
const PAD = { top: 12, bottom: 20, left: 4, right: 44 };

const timeLabel = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  hour: "numeric",
});

const readoutLabel = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});

export function GapChart({
  series,
  referencePhrase,
  dark = false,
}: {
  series: GapPoint[];
  referencePhrase: string;
  dark?: boolean;
}) {
  const [hover, setHover] = useState<GapPoint | null>(null);
  const axis = dark ? "rgba(255,255,255,0.22)" : "var(--line)";
  const label = dark ? "var(--on-dark-muted)" : "var(--muted)";
  if (series.length < 4) {
    return (
      <p className={dark ? "text-on-dark-muted text-sm" : "text-muted text-sm"}>
        The gap history fills in as we watch this stock. Check back in an hour.
      </p>
    );
  }
  const maxAbs = Math.max(0.5, ...series.map((p) => Math.abs(p.gapPct)));
  const from = series[0].ts;
  const to = series[series.length - 1].ts;
  const x = (ts: number) =>
    PAD.left +
    ((ts - from) / Math.max(1, to - from)) * (W - PAD.left - PAD.right);
  const zero = PAD.top + (H - PAD.top - PAD.bottom) / 2;
  const scale = (H - PAD.top - PAD.bottom) / 2 / maxAbs;
  const barW = Math.max(1.5, (W - PAD.left - PAD.right) / series.length - 1);
  const last = series[series.length - 1];
  const avg = series.reduce((a, p) => a + p.gapPct, 0) / series.length;
  const ticks = [series[0], series[Math.floor(series.length / 2)], last];

  function pick(target: SVGSVGElement, clientX: number) {
    const rect = target.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    const ts =
      from + ((px - PAD.left) / (W - PAD.left - PAD.right)) * (to - from);
    let best = series[0];
    for (const p of series)
      if (Math.abs(p.ts - ts) < Math.abs(best.ts - ts)) best = p;
    setHover(best);
  }
  // A finger gets the same readout as a pointer, and it stays after lifting.
  const onTouch = (e: React.TouchEvent<SVGSVGElement>) => {
    const t = e.touches[0];
    if (t) pick(e.currentTarget, t.clientX);
  };

  // Near the right edge the card would hang off the chart, so it flips.
  const flip = hover ? x(hover.ts) > W * 0.6 : false;
  const box = { w: 166, h: 42 };
  const card = dark ? "#ffffff" : "var(--ink)";
  const cardInk = dark ? "var(--ink)" : "#ffffff";
  const cardMuted = dark ? "var(--muted)" : "rgba(255,255,255,0.65)";
  // The card is white on the dark chart and near-black on the light one, so
  // the blue has to flip with it to stay legible.
  const cardBlue = dark ? "var(--blue)" : "var(--blue-light)";

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full cursor-crosshair touch-pan-y"
        role="img"
        aria-label="Gap between onchain and reference price"
        onMouseMove={(e) => pick(e.currentTarget, e.clientX)}
        onMouseLeave={() => setHover(null)}
        onTouchStart={onTouch}
        onTouchMove={onTouch}
      >
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={zero}
          y2={zero}
          stroke={axis}
        />
        {series.map((p) => {
          const h = Math.abs(p.gapPct) * scale;
          const up = p.gapPct >= 0;
          return (
            <rect
              key={p.ts}
              x={x(p.ts) - barW / 2}
              y={up ? zero - h : zero}
              width={barW}
              height={Math.max(1, h)}
              rx={1}
              fill={up ? "var(--down)" : "var(--blue)"}
              opacity={hover && hover.ts !== p.ts ? 0.4 : 1}
            />
          );
        })}
        <text x={W - PAD.right + 6} y={PAD.top + 8} fontSize="10" fill={label}>
          +{maxAbs.toFixed(1)}%
        </text>
        <text
          x={W - PAD.right + 6}
          y={H - PAD.bottom}
          fontSize="10"
          fill={label}
        >
          -{maxAbs.toFixed(1)}%
        </text>
        {ticks.map((t) => (
          <text
            key={t.ts}
            x={x(t.ts)}
            y={H - 6}
            fontSize="10"
            fill={label}
            textAnchor="middle"
          >
            {timeLabel.format(new Date(t.ts))}
          </text>
        ))}

        {hover && (
          <g>
            <line
              x1={x(hover.ts)}
              x2={x(hover.ts)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke={axis}
            />
            <circle
              cx={x(hover.ts)}
              cy={zero - hover.gapPct * scale}
              r="3.5"
              fill={hover.gapPct >= 0 ? "var(--down)" : "var(--blue)"}
              stroke={dark ? "var(--ink)" : "#ffffff"}
              strokeWidth="1.5"
            />
            <g
              transform={`translate(${flip ? x(hover.ts) - box.w - 8 : x(hover.ts) + 8}, ${PAD.top})`}
            >
              <rect width={box.w} height={box.h} rx="12" fill={card} />
              <text x="11" y="17" fontSize="11" fill={cardMuted}>
                {readoutLabel.format(new Date(hover.ts))} ET
              </text>
              <text
                x="11"
                y="32"
                fontSize="12.5"
                fontWeight="600"
                fill={
                  Math.abs(hover.gapPct) < 0.05
                    ? cardInk
                    : hover.gapPct > 0
                      ? "var(--down)"
                      : cardBlue
                }
              >
                {hover.gapPct > 0 ? "+" : ""}
                {hover.gapPct.toFixed(2)}%
              </text>
            </g>
          </g>
        )}
      </svg>
      <p
        className={`mt-2 text-sm ${dark ? "text-on-dark-muted" : "text-muted"}`}
      >
        Right now{" "}
        <span className={`num font-medium ${gapTone(last.gapPct)}`}>
          {gapSentence(last.gapPct, referencePhrase)}
        </span>
        ; on average{" "}
        <span className={`num ${gapTone(avg)}`}>{gapWords(avg)}</span> over the
        last two days. Point at a bar for that hour on its own.
      </p>
    </div>
  );
}
