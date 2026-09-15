// The shape of a single-segment Meteora bonding curve: price against the
// quote raised. For a constant-product segment the square root of the
// price grows linearly with the quote collected, so the line is exact for
// what buildCurveWithMarketCap produces, not an illustration. No hooks, so
// it renders on the server and in the client alike.

const W = 320;
const H = 150;
const PAD = { top: 14, right: 12, bottom: 26, left: 12 };

export function CurveShape({
  startLabel,
  endLabel,
  raiseLabel,
  ratio,
  fill = "var(--color-blue)",
  progress = null,
  className = "",
}: {
  startLabel: string;
  endLabel: string;
  raiseLabel: string;
  /** Graduation price over starting price. */
  ratio: number;
  fill?: string;
  /** 0..1 of the raise already collected, drawn as a marker. */
  progress?: number | null;
  className?: string;
}) {
  const r = Math.max(1.01, ratio);
  const s0 = 1;
  const s1 = Math.sqrt(r);
  const n = 40;
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const p = (s0 + (s1 - s0) * f) ** 2; // price relative to the start
    const x = PAD.left + f * (W - PAD.left - PAD.right);
    const y = PAD.top + (1 - (p - 1) / (r - 1)) * (H - PAD.top - PAD.bottom);
    pts.push([x, y]);
  }
  const line = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const base = H - PAD.bottom;
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${base} L${pts[0][0].toFixed(1)},${base} Z`;
  const marker =
    progress == null
      ? null
      : pts[Math.round(Math.max(0, Math.min(1, progress)) * n)];
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={`h-auto w-full ${className}`}
      role="img"
      aria-label={`Price rises from ${startLabel} to ${endLabel} while ${raiseLabel} is raised`}
    >
      <path d={area} fill={fill} fillOpacity={0.14} />
      <path
        d={line}
        fill="none"
        stroke={fill}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      {marker && (
        <>
          <line
            x1={marker[0]}
            y1={marker[1]}
            x2={marker[0]}
            y2={base}
            stroke={fill}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <circle cx={marker[0]} cy={marker[1]} r={4} fill={fill} />
        </>
      )}
      <text
        x={PAD.left}
        y={base + 16}
        fontSize={10}
        fill="currentColor"
        opacity={0.7}
      >
        {startLabel}
      </text>
      <text
        x={W - PAD.right}
        y={base + 16}
        fontSize={10}
        fill="currentColor"
        opacity={0.7}
        textAnchor="end"
      >
        {endLabel}
      </text>
      <text
        x={W / 2}
        y={base + 16}
        fontSize={10}
        fill="currentColor"
        opacity={0.5}
        textAnchor="middle"
      >
        {raiseLabel}
      </text>
    </svg>
  );
}
