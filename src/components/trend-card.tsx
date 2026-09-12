import Link from "next/link";
import type { RadarRow } from "@/lib/radar-types";
import { formatPct, formatUsd } from "@/lib/format";
import { Sparkline } from "./sparkline";
import { TickerBadge } from "./ticker-badge";
import { CountUp } from "./count-up";

/** Dark "trending" tile: badge, name, sparkline, price and change. */
export function TrendCard({ row }: { row: RadarRow }) {
  const up = (row.gapPct ?? 0) >= 0;
  return (
    <Link href={`/stock/${row.underlying}`} className="card-dark flex flex-col justify-between gap-4 p-4 transition hover:opacity-95">
      <div className="flex items-center gap-2.5">
        <TickerBadge symbol={row.symbol} size={32} dark />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{row.symbol}</div>
          <div className="text-on-dark-muted truncate text-xs">{row.name}</div>
        </div>
      </div>
      <div className="h-12">
        <Sparkline values={row.spark} width={200} height={48} color="var(--blue)" fill />
      </div>
      <div>
        <div className="num text-xl font-semibold">
          {row.price == null ? "–" : <CountUp value={row.price} from={0.9} kind="usd" />}
        </div>
        <div className={`num text-xs ${up ? "text-blue-light" : "text-down"}`}>{formatPct(row.gapPct)} vs close</div>
      </div>
    </Link>
  );
}
