type Props = { values: number[]; width?: number; height?: number; color?: string; fill?: boolean; /** Fill the container width, keeping the height. */ stretch?: boolean };

/** Tiny inline line chart. */
export function Sparkline({ values, width = 84, height = 24, color = "var(--ink)", fill = false, stretch = false }: Props) {
  if (values.length < 2) {
    return <span className="text-muted text-xs">–</span>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => [i * step, height - 2 - ((v - min) / span) * (height - 4)] as const);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `M0,${height} L${line.replace(/ /g, " L")} L${width},${height} Z`;
  return (
    <svg
      width={stretch ? undefined : width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={stretch ? "none" : "xMidYMid meet"}
      aria-hidden="true"
      className={stretch ? "block w-full" : "max-w-full"}
    >
      {fill && <path d={area} fill={color} opacity="0.18" />}
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
