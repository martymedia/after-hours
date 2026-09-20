// Every private company against its own mark, as bars around a zero line.
// Bars, not dots on a line: eight companies cluster near zero and their
// labels would sit on top of each other. Server-safe, no hooks.

import type { PreIpoRow } from "@/lib/pre-ipo";

export function PremiumBars({
  rows,
  className = "",
}: {
  rows: PreIpoRow[];
  className?: string;
}) {
  const points = rows.filter((r) => r.premiumPct != null);
  if (points.length === 0) return null;
  const span = Math.max(
    5,
    ...points.map((r) => Math.abs(r.premiumPct as number)),
  );
  const ordered = [...points].sort(
    (a, b) => (b.premiumPct as number) - (a.premiumPct as number),
  );

  return (
    <ul className={`flex flex-col gap-1.5 ${className}`}>
      {ordered.map((r) => {
        const pct = r.premiumPct as number;
        const width = `${(Math.abs(pct) / span) * 50}%`;
        const above = pct > 0;
        return (
          <li
            key={r.underlying}
            className="grid grid-cols-[minmax(0,5.5rem)_1fr_3.2rem] items-center gap-2 text-xs"
          >
            <span className="truncate opacity-80">{r.name}</span>
            {/* One track, the mark in the middle, the bar growing out of it */}
            <span className="relative flex h-3.5 items-center">
              <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-current opacity-25" />
              <span
                className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
                style={{
                  width,
                  [above ? "left" : "right"]: "50%",
                  background: above ? "var(--color-down)" : "var(--color-blue)",
                }}
              />
            </span>
            <span
              className={`num text-right ${Math.abs(pct) < 0.25 ? "opacity-60" : above ? "text-down" : "text-blue-light"}`}
            >
              {pct > 0 ? "+" : ""}
              {pct.toFixed(1)}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}
