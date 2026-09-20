// Every private company on one line: where the market prices it against the
// mark its issuer carries it at. Zero in the middle, cheaper to the left,
// pricier to the right. No hooks, so it renders on the server.

import type { PreIpoRow } from "@/lib/pre-ipo";

const W = 640;
const H = 96;
const PAD = 34;
const MID = H / 2 + 6;

export function PremiumScale({
  rows,
  className = "",
}: {
  rows: PreIpoRow[];
  className?: string;
}) {
  const points = rows.filter((r) => r.premiumPct != null);
  if (points.length < 2) return null;
  // A symmetric scale, so the middle really is the mark.
  const span = Math.max(
    5,
    ...points.map((r) => Math.abs(r.premiumPct as number)),
  );
  const x = (pct: number) => W / 2 + (pct / span) * (W / 2 - PAD);
  const ordered = [...points].sort(
    (a, b) => (a.premiumPct as number) - (b.premiumPct as number),
  );

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={`h-auto w-full ${className}`}
      role="img"
      aria-label={`Premium to the mark, from ${ordered[0].underlying} at ${(ordered[0].premiumPct as number).toFixed(1)} percent to ${ordered[ordered.length - 1].underlying} at ${(ordered[ordered.length - 1].premiumPct as number).toFixed(1)} percent`}
    >
      {/* The axis, and the mark itself as the line in the middle */}
      <line
        x1={PAD}
        y1={MID}
        x2={W - PAD}
        y2={MID}
        stroke="currentColor"
        strokeOpacity={0.25}
        strokeWidth={1}
      />
      <line
        x1={W / 2}
        y1={MID - 22}
        x2={W / 2}
        y2={MID + 14}
        stroke="currentColor"
        strokeOpacity={0.5}
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      <text
        x={W / 2}
        y={MID + 26}
        fontSize={10}
        textAnchor="middle"
        fill="currentColor"
        opacity={0.6}
      >
        at the mark
      </text>

      {ordered.map((r, i) => {
        const pct = r.premiumPct as number;
        const cx = x(pct);
        const above = pct > 0;
        // Labels alternate sides of the line so neighbours never collide.
        const up = i % 2 === 0;
        return (
          <g key={r.underlying}>
            <circle
              cx={cx}
              cy={MID}
              r={5}
              fill={
                Math.abs(pct) < 0.25
                  ? "currentColor"
                  : above
                    ? "var(--color-down)"
                    : "var(--color-blue)"
              }
              fillOpacity={Math.abs(pct) < 0.25 ? 0.5 : 1}
            />
            <text
              x={cx}
              y={up ? MID - 12 : MID + 20}
              fontSize={10}
              textAnchor="middle"
              fill="currentColor"
              opacity={0.85}
            >
              {r.underlying}
            </text>
            <text
              x={cx}
              y={up ? MID - 24 : MID + 32}
              fontSize={10}
              textAnchor="middle"
              fill="currentColor"
              opacity={0.55}
            >
              {pct > 0 ? "+" : ""}
              {pct.toFixed(0)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}
