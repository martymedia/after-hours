import Link from "next/link";
import type { RadarRow } from "@/lib/radar-types";
import { Sparkline } from "./sparkline";
import { TickerBadge } from "./ticker-badge";
import { CountUp } from "./count-up";
import { Tilt } from "./motion";

/** Dark tile: badge, name, sparkline, price, and whether onchain is cheaper
 *  or pricier than the last Wall Street print. Cheaper is blue, pricier red. */
export function TrendCard({ row }: { row: RadarRow }) {
  const gap = row.gapPct ?? 0;
  const cheaper = gap < 0;
  return (
    <Tilt className="flex" cardClassName="card-dark flex w-full overflow-hidden">
      <Link href={`/stock/${row.underlying}`} className="flex w-full flex-col justify-between gap-4 p-4">
      <div className="flex items-center gap-2.5">
        <TickerBadge symbol={row.symbol} logo={row.logo} size={32} dark />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{row.symbol}</div>
          <div className="text-on-dark-muted truncate text-xs">{row.name}</div>
        </div>
      </div>
      <div className="h-12">
        <Sparkline values={row.spark} width={200} height={48} color={cheaper ? "var(--blue)" : "var(--down)"} fill />
      </div>
      <div>
        <div className="num text-xl font-semibold">{row.price == null ? "–" : <CountUp value={row.price} from={0.9} kind="usd" />}</div>
        <div className={`num text-xs ${cheaper ? "text-blue-light" : "text-down"}`}>
          {Math.abs(gap).toFixed(2)}% {cheaper ? "cheaper" : "pricier"} than close
        </div>
      </div>
      </Link>
    </Tilt>
  );
}
