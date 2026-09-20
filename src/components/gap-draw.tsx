"use client";

// The gap, drawn: the onchain price of one stock against the Wall Street
// print over the last day. Both lines draw themselves in when the chart
// scrolls into view; the space between them fills blue where onchain was
// cheaper and red where it was pricier. Real snapshots, nothing smoothed.

import { useEffect, useRef } from "react";
import { formatUsd } from "@/lib/format";

export type GapPoint = { t: number; onchain: number; ref: number };

const W = 640;
const H = 220;
const PAD = { top: 14, right: 88, bottom: 22, left: 8 };
// The two end labels sit to the right of the last point, so the room they
// need is the room the plot has to give up. A fixed 88 was enough for
// "close $6.05" and cut "Friday close $6.05" off at the edge.
const LABEL_GAP = 8;
const CHAR_W = 6.15; // Outfit at 11px, measured against the widest label.
// Six spare units, because CHAR_W is an average and a label of wide glyphs
// would otherwise land a pixel or two past the edge.
const SLACK = 6;
const rightRoomFor = (...labels: string[]) =>
  Math.min(
    212,
    Math.max(
      88,
      LABEL_GAP + Math.max(...labels.map((l) => l.length)) * CHAR_W + SLACK,
    ),
  );

const clock = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
});

export function GapDraw({
  points,
  symbol,
  referenceShort,
}: {
  points: GapPoint[];
  symbol: string;
  referenceShort: string;
}) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      el.classList.add("is-in");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.add("is-in");
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (points.length < 2) return null;
  const values = points.flatMap((p) => [p.onchain, p.ref]);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  const margin = Math.max((hi - lo) * 0.12, hi * 0.002);
  lo -= margin;
  hi += margin;
  const last = points[points.length - 1];
  const onchainLabel = `onchain ${formatUsd(last.onchain)}`;
  const refLabel = `${referenceShort} ${formatUsd(last.ref)}`;
  const padRight = rightRoomFor(onchainLabel, refLabel);
  const x = (i: number) =>
    PAD.left + (i / (points.length - 1)) * (W - PAD.left - padRight);
  const y = (v: number) =>
    PAD.top + (1 - (v - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);

  const line = (pick: (p: GapPoint) => number) =>
    points
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(pick(p)).toFixed(1)}`,
      )
      .join(" ");
  const quads = points.slice(1).map((p, j) => {
    const q = points[j];
    const mid = (p.onchain - p.ref + (q.onchain - q.ref)) / 2;
    return {
      d: `M${x(j).toFixed(1)},${y(q.onchain).toFixed(1)} L${x(j + 1).toFixed(1)},${y(p.onchain).toFixed(1)} L${x(j + 1).toFixed(1)},${y(p.ref).toFixed(1)} L${x(j).toFixed(1)},${y(q.ref).toFixed(1)} Z`,
      cheaper: mid < 0,
      delay: j * 9,
    };
  });
  const gaps = points.map((p) => (p.onchain / p.ref - 1) * 100);
  const deepest = Math.min(...gaps);
  const highest = Math.max(...gaps);
  const lastGap = gaps[gaps.length - 1];
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) =>
    Math.round(f * (points.length - 1)),
  );

  return (
    <div ref={box} className="t-draw mt-5">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${symbol} onchain price against ${referenceShort} over the last day`}
      >
        {quads.map((q, i) => (
          <path
            key={i}
            d={q.d}
            className="t-quad"
            style={{ animationDelay: `${q.delay}ms` }}
            fill={q.cheaper ? "var(--color-blue)" : "var(--color-down)"}
            fillOpacity={0.22}
          />
        ))}
        <path
          d={line((p) => p.ref)}
          className="t-line t-line--ref"
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />
        <path
          d={line((p) => p.onchain)}
          className="t-line t-line--on"
          fill="none"
          stroke="var(--color-blue)"
          strokeWidth={2.2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle
          cx={x(points.length - 1)}
          cy={y(last.onchain)}
          r={3.5}
          fill="var(--color-blue)"
          className="t-dot"
        />
        <text
          x={x(points.length - 1) + 8}
          y={y(last.onchain) + 4}
          className="t-label"
          fontSize={11}
          fill="var(--color-blue)"
          fontWeight={600}
        >
          {onchainLabel}
        </text>
        <text
          x={x(points.length - 1) + 8}
          y={y(last.ref) + 4}
          className="t-label"
          fontSize={11}
          fill="var(--color-muted)"
        >
          {refLabel}
        </text>
        {ticks.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 6}
            fontSize={10}
            fill="var(--color-muted-2)"
            textAnchor={
              i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"
            }
          >
            {clock.format(new Date(points[i].t))}
          </text>
        ))}
      </svg>
      <div className="num text-muted mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
        <span>
          now{" "}
          <span className={lastGap < 0 ? "text-blue" : "text-down"}>
            {Math.abs(lastGap).toFixed(2)}%{" "}
            {lastGap < 0 ? "cheaper" : "pricier"}
          </span>
        </span>
        <span>
          deepest discount{" "}
          <span className="text-blue">
            {deepest < 0 ? `${Math.abs(deepest).toFixed(2)}%` : "none"}
          </span>
        </span>
        <span>
          highest premium{" "}
          <span className="text-down">
            {highest > 0 ? `${highest.toFixed(2)}%` : "none"}
          </span>
        </span>
        <span>{points.length} snapshots, New York time</span>
      </div>
    </div>
  );
}
