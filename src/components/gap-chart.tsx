// Gap radar: onchain price versus the reference over the last 48 hours as
// bars around a zero line. Blue above (onchain higher), grey below.

import type { GapPoint } from "@/lib/stock-types";
import { formatPct } from "@/lib/format";

const W = 600;
const H = 120;
const PAD = { top: 12, bottom: 20, left: 4, right: 44 };

const timeLabel = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric" });

export function GapChart({ series, referencePhrase }: { series: GapPoint[]; referencePhrase: string }) {
  if (series.length < 4) {
    return (
      <p className="text-muted text-sm">
        The gap history fills in as we watch this stock. Check back in an hour.
      </p>
    );
  }
  const maxAbs = Math.max(0.5, ...series.map((p) => Math.abs(p.gapPct)));
  const from = series[0].ts;
  const to = series[series.length - 1].ts;
  const x = (ts: number) => PAD.left + ((ts - from) / Math.max(1, to - from)) * (W - PAD.left - PAD.right);
  const zero = PAD.top + (H - PAD.top - PAD.bottom) / 2;
  const scale = (H - PAD.top - PAD.bottom) / 2 / maxAbs;
  const barW = Math.max(1.5, (W - PAD.left - PAD.right) / series.length - 1);
  const last = series[series.length - 1];
  const avg = series.reduce((a, p) => a + p.gapPct, 0) / series.length;
  const ticks = [series[0], series[Math.floor(series.length / 2)], last];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Gap between onchain and reference price">
        <line x1={PAD.left} x2={W - PAD.right} y1={zero} y2={zero} stroke="var(--line)" />
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
              fill={up ? "var(--blue)" : "var(--muted-2)"}
            />
          );
        })}
        <text x={W - PAD.right + 6} y={PAD.top + 8} fontSize="10" fill="var(--muted)">
          +{maxAbs.toFixed(1)}%
        </text>
        <text x={W - PAD.right + 6} y={H - PAD.bottom} fontSize="10" fill="var(--muted)">
          -{maxAbs.toFixed(1)}%
        </text>
        {ticks.map((t) => (
          <text key={t.ts} x={x(t.ts)} y={H - 6} fontSize="10" fill="var(--muted)" textAnchor="middle">
            {timeLabel.format(new Date(t.ts))}
          </text>
        ))}
      </svg>
      <p className="text-muted mt-2 text-sm">
        Right now <span className={`num font-medium ${last.gapPct >= 0 ? "text-blue" : "text-ink"}`}>{formatPct(last.gapPct)}</span>{" "}
        vs {referencePhrase}, averaging <span className="num">{formatPct(avg)}</span> over the last two days.
      </p>
    </div>
  );
}
