import Link from "next/link";
import type { RadarRow } from "@/lib/radar-types";
import { gapIsOutlier } from "@/lib/format";
import { Tip } from "./tip";

// The night at a glance: every tradable stock as a tile, area by liquidity,
// colour by how far the onchain price sits from the reference. Blue means
// cheaper than Wall Street, red pricier, grey in line. Squarified treemap,
// laid out in percentages so it fills whatever width it gets.

type Rect = { x: number; y: number; w: number; h: number };
type Tile = { row: RadarRow; rect: Rect };

function squarify(items: { row: RadarRow; value: number }[], rect: Rect): Tile[] {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!items.length || total <= 0) return [];
  const out: Tile[] = [];
  let remaining = [...items].sort((a, b) => b.value - a.value);
  let r = { ...rect };
  while (remaining.length) {
    const area = r.w * r.h;
    const scale = area / remaining.reduce((s, i) => s + i.value, 0);
    const side = Math.min(r.w, r.h);
    let strip: typeof remaining = [];
    let best = Infinity;
    for (const item of remaining) {
      const candidate = [...strip, item];
      const sum = candidate.reduce((s, i) => s + i.value * scale, 0);
      const worst = Math.max(
        ...candidate.map((i) => {
          const a = i.value * scale;
          const len = sum / side;
          const other = a / len;
          return Math.max(len / other, other / len);
        }),
      );
      if (worst <= best) {
        strip = candidate;
        best = worst;
      } else break;
    }
    const sum = strip.reduce((s, i) => s + i.value * scale, 0);
    const horizontal = r.w >= r.h;
    const len = sum / side; // thickness of the strip
    let offset = 0;
    for (const i of strip) {
      const a = i.value * scale;
      const along = a / len;
      out.push({
        row: i.row,
        rect: horizontal ? { x: r.x, y: r.y + offset, w: len, h: along } : { x: r.x + offset, y: r.y, w: along, h: len },
      });
      offset += along;
    }
    if (horizontal) {
      r = { x: r.x + len, y: r.y, w: r.w - len, h: r.h };
    } else {
      r = { x: r.x, y: r.y + len, w: r.w, h: r.h - len };
    }
    remaining = remaining.slice(strip.length);
  }
  return out;
}

function fill(gap: number | null): string {
  if (gap == null || Math.abs(gap) < 0.25) return "var(--soft)";
  const k = Math.min(1, (Math.abs(gap) - 0.25) / 5); // full colour at 5.25 % and beyond
  const alpha = 0.14 + 0.5 * k;
  return gap < 0 ? `rgba(91,145,255,${alpha.toFixed(2)})` : `rgba(229,72,77,${alpha.toFixed(2)})`;
}

// Two layouts: phones get fewer, squarer tiles; wider screens get more.
const DESKTOP = { aspect: 4, max: 24, className: "hidden h-56 sm:block" };
const PHONE = { aspect: 1.5, max: 12, className: "h-52 sm:hidden" };

export function Heatmap({ rows, referencePhrase }: { rows: RadarRow[]; referencePhrase: string }) {
  const eligible = rows
    .filter((r) => r.price != null && r.gapPct != null && !gapIsOutlier(r.gapPct) && (r.tradability === "easy" || r.tradability === "ok"))
    .sort((a, b) => b.liquidity - a.liquidity);
  const cheaper = eligible.filter((r) => (r.gapPct ?? 0) < -0.25).length;
  const pricier = eligible.filter((r) => (r.gapPct ?? 0) > 0.25).length;

  return (
    <section className="card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-muted text-xs">
          At a glance: <span className="text-blue">{cheaper} cheaper</span>, <span className="text-down">{pricier} pricier</span>,{" "}
          {eligible.length - cheaper - pricier} in line with {referencePhrase}. The deepest pools, tile size follows liquidity; the full list is below.
        </p>
        <Tip text="Colour is the gap between the onchain price and the reference: blue below, red above, grey within a quarter percent. Bigger tiles are deeper pools, so their colour means more." underline={false} className="text-muted-2 hover:text-ink text-xs">
          How to read it
        </Tip>
      </div>
      <Strip rows={eligible} referencePhrase={referencePhrase} {...DESKTOP} />
      <Strip rows={eligible} referencePhrase={referencePhrase} {...PHONE} />
    </section>
  );
}

function Strip({ rows, referencePhrase, aspect, max, className }: { rows: RadarRow[]; referencePhrase: string; aspect: number; max: number; className: string }) {
  const items = rows.slice(0, max).map((r) => ({ row: r, value: Math.sqrt(Math.max(r.liquidity, 1)) }));
  const tiles = squarify(items, { x: 0, y: 0, w: 100 * aspect, h: 100 });
  return (
    <div className={`relative w-full ${className}`} role="list" aria-label="Stocks by liquidity and price gap">
      {tiles.map(({ row, rect }) => {
        // Percent of the strip: symbol needs a tile at least ~12% tall and 8% wide, the gap line more.
        const wPct = rect.w / aspect;
        const showSymbol = rect.h >= 12 && wPct >= 8;
        const big = rect.h >= 24 && wPct >= 12;
        const gap = row.gapPct ?? 0;
        const label = Math.abs(gap) < 0.25 ? "in line" : `${gap < 0 ? "−" : "+"}${Math.abs(gap).toFixed(1)}%`;
        return (
          <Link
            key={row.underlying}
            href={`/stock/${row.underlying}`}
            role="listitem"
            title={`${row.name}: ${label} vs ${referencePhrase}`}
            className="absolute flex flex-col justify-end overflow-hidden rounded-md p-1 text-ink transition hover:z-10 hover:brightness-95 sm:p-1.5"
            style={{ left: `${rect.x / aspect}%`, top: `${rect.y}%`, width: `calc(${wPct}% - 3px)`, height: `calc(${rect.h}% - 3px)`, background: fill(row.gapPct) }}
          >
            {showSymbol && <span className="num truncate text-[10px] font-semibold sm:text-[11px]">{row.underlying}</span>}
            {big && <span className="num text-muted truncate text-[10px]">{label}</span>}
          </Link>
        );
      })}
    </div>
  );
}
