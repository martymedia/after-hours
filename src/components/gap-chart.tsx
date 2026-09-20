"use client";

// Gap radar: onchain price versus the reference over the last 48 hours as
// bars around the reference line. Red above, blue below. Pointing at a bar
// reads out the hour it covers and what the gap was then, because "on
// average 26% over two days" hides every hour that was not average.
//
// Two things about how this is drawn. The bars live in an SVG that stretches
// to the container, but every piece of text sits in HTML on top of it: text
// inside a stretched viewBox grows with the container, and at full width the
// labels came out about twice the size of the prose next to them.
//
// And the scale follows the data instead of straddling zero symmetrically. A
// series that never goes below the mark spent half the picture on empty space
// under the line, which squashed the part anyone came to look at.

import { useState } from "react";
import type { GapPoint } from "@/lib/stock-types";
import { gapSentence, gapTone, gapWords } from "@/lib/format";

const W = 600;
const H = 100;

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

const signed = (pct: number) => `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`;

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
  const axis = dark ? "rgba(255,255,255,0.28)" : "var(--line)";
  const faint = dark ? "text-on-dark-muted" : "text-muted-2";

  if (series.length < 4) {
    return (
      <p className={dark ? "text-on-dark-muted text-sm" : "text-muted text-sm"}>
        The gap history fills in as we watch this stock. Check back in an hour.
      </p>
    );
  }

  const values = series.map((p) => p.gapPct);
  // Zero always stays in the picture, because the distance to it is the whole
  // point, but it does not have to sit in the middle.
  const top = Math.max(0, ...values);
  const bottom = Math.min(0, ...values);
  const pad = Math.max(0.6, top - bottom) * 0.12;
  const hi = top + pad;
  const lo = bottom - pad;

  const from = series[0].ts;
  const to = series[series.length - 1].ts;
  /** Position along the chart, 0 to 1, so HTML and SVG can share it. */
  const at = (ts: number) => (ts - from) / Math.max(1, to - from);
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  const zero = y(0);
  const slot = W / series.length;
  const barW = Math.max(1.2, slot * 0.76);

  const last = series[series.length - 1];
  const avg = values.reduce((a, v) => a + v, 0) / series.length;
  const mid = series[Math.floor(series.length / 2)];

  function pick(clientX: number, el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const ts = from + f * (to - from);
    let best = series[0];
    for (const p of series)
      if (Math.abs(p.ts - ts) < Math.abs(best.ts - ts)) best = p;
    setHover(best);
  }
  // A finger gets the same readout as a pointer, and it stays after lifting.
  const onTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    if (t) pick(t.clientX, e.currentTarget);
  };

  const pos = hover ? at(hover.ts) : 0;
  const flip = pos > 0.6;
  const tone = (v: number) =>
    Math.abs(v) < 0.05
      ? dark
        ? "#ffffff"
        : "var(--ink)"
      : v > 0
        ? "var(--down)"
        : "var(--blue)";

  return (
    <div>
      <div
        className="relative h-32 cursor-crosshair touch-pan-y select-none sm:h-36"
        onMouseMove={(e) => pick(e.clientX, e.currentTarget)}
        onMouseLeave={() => setHover(null)}
        onTouchStart={onTouch}
        onTouchMove={onTouch}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-full w-full"
          role="img"
          aria-label={`Gap against ${referencePhrase} over the last two days`}
        >
          {series.map((p) => (
            <rect
              key={p.ts}
              x={at(p.ts) * (W - slot) + (slot - barW) / 2}
              y={p.gapPct >= 0 ? y(p.gapPct) : zero}
              width={barW}
              height={Math.max(0.8, Math.abs(y(p.gapPct) - zero))}
              fill={p.gapPct >= 0 ? "var(--down)" : "var(--blue)"}
              opacity={hover && hover.ts !== p.ts ? 0.35 : 1}
            />
          ))}
          <line x1={0} x2={W} y1={zero} y2={zero} stroke={axis} />
        </svg>

        {/* Every label below is HTML, so it keeps its size at any width. */}
        <span
          className={`${faint} pointer-events-none absolute top-0 right-0 text-[10px] leading-none`}
        >
          {signed(top)}
        </span>
        <span
          className={`${faint} pointer-events-none absolute right-0 text-[10px] leading-none`}
          style={{ top: `${(zero / H) * 100}%`, transform: "translateY(-130%)" }}
        >
          the mark
        </span>

        {hover && (
          <>
            <span
              className="pointer-events-none absolute inset-y-0 w-px"
              style={{ left: `${pos * 100}%`, background: axis }}
            />
            <span
              className="pointer-events-none absolute h-2 w-2 rounded-full"
              style={{
                left: `${pos * 100}%`,
                top: `${(y(hover.gapPct) / H) * 100}%`,
                transform: "translate(-50%, -50%)",
                background: tone(hover.gapPct),
                boxShadow: `0 0 0 2px ${dark ? "var(--ink)" : "#ffffff"}`,
              }}
            />
            <div
              className={`pointer-events-none absolute top-1 rounded-xl px-2.5 py-1.5 shadow-sm ${dark ? "bg-white" : "bg-ink"}`}
              style={{
                left: `${pos * 100}%`,
                transform: flip
                  ? "translateX(calc(-100% - 10px))"
                  : "translateX(10px)",
              }}
            >
              <div
                className={`text-[10px] leading-tight ${dark ? "text-muted" : "text-on-dark-muted"}`}
              >
                {readoutLabel.format(new Date(hover.ts))} ET
              </div>
              <div
                className="num text-[13px] leading-tight font-semibold"
                style={{ color: tone(hover.gapPct) }}
              >
                {signed(hover.gapPct)}
              </div>
            </div>
          </>
        )}
      </div>

      <div className={`${faint} num mt-1.5 flex justify-between text-[11px]`}>
        <span>{timeLabel.format(new Date(from))}</span>
        <span>{timeLabel.format(new Date(mid.ts))}</span>
        <span>{timeLabel.format(new Date(to))}</span>
      </div>

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
