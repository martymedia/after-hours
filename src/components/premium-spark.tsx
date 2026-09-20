// The premium of one company over the last two days, drawn around the mark
// rather than around its own minimum: the zero line is the point, so it
// stays in the picture even when the series never crosses it.

const SMALL_W = 120;
const SMALL_H = 40;
// The strip under a card headline: wider, so the shape has somewhere to go.
const STRIP_W = 320;
const STRIP_H = 56;

export function PremiumSpark({
  values,
  strip = false,
  className = "",
}: {
  values: number[];
  /** Full width of its container rather than a small corner mark. */
  strip?: boolean;
  className?: string;
}) {
  if (values.length < 3) return null;
  const W = strip ? STRIP_W : SMALL_W;
  const H = strip ? STRIP_H : SMALL_H;
  const span = Math.max(0.5, ...values.map((v) => Math.abs(v)));
  const y = (v: number) => H / 2 - (v / span) * (H / 2 - 3);
  const step = W / (values.length - 1);
  const pts = values.map((v, i) => [i * step, y(v)] as const);
  const line = pts
    .map(([x, py]) => `${x.toFixed(1)},${py.toFixed(1)}`)
    .join(" ");
  const last = values[values.length - 1];
  const tone = last >= 0 ? "var(--color-down)" : "var(--color-blue)";
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      {...(strip ? {} : { width: W, height: H })}
      className={`${strip ? "h-auto w-full" : "shrink-0"} ${className}`}
      aria-hidden="true"
    >
      {/* Everything is measured from here: the issuer's mark */}
      <line
        x1="0"
        y1={H / 2}
        x2={W}
        y2={H / 2}
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeDasharray="2 3"
      />
      <polygon
        points={`0,${H / 2} ${line} ${W},${H / 2}`}
        fill={tone}
        fillOpacity="0.14"
      />
      <polyline
        points={line}
        fill="none"
        stroke={tone}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={W} cy={y(last)} r="2.4" fill={tone} />
    </svg>
  );
}
