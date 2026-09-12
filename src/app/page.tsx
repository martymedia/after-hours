import Link from "next/link";
import { Clock, Activity, TrendingUp, CalendarDays } from "lucide-react";
import { GlobeHero } from "@/components/globe-hero";
import { StatCard } from "@/components/stat-card";
import { TrendCard } from "@/components/trend-card";
import { TickerBadge } from "@/components/ticker-badge";
import { CountUp } from "@/components/count-up";
import { getRadar } from "@/lib/radar";
import { formatDuration, formatPct, formatUsd } from "@/lib/format";
import { TRADABILITY_LABEL, type Tradability } from "@/lib/radar-types";

export const dynamic = "force-dynamic";

const PILL: Record<Tradability, string> = {
  easy: "bg-soft-up text-up",
  ok: "bg-soft text-ink",
  thin: "bg-soft-warn text-warn",
  stale: "bg-soft-warn text-warn",
  none: "bg-soft text-muted",
};

const earningsDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export default function OverviewPage() {
  const data = getRadar();
  const now = Date.parse(data.generatedAt);
  const rows = data.rows.slice(0, 10);
  const movers = [...data.rows]
    .filter((r) => r.gapPct != null && r.spark.length > 2)
    .sort((a, b) => Math.abs(b.gapPct ?? 0) - Math.abs(a.gapPct ?? 0))
    .slice(0, 6);
  const top = movers[0];
  const nextEarnings = data.earnings[0];
  const closed = data.phase.phase !== "open";

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          index={0}
          icon={Clock}
          label="Wall Street"
          href="/how"
          value={closed ? "Closed" : "Open"}
          detail={closed ? `opens in ${formatDuration(new Date(data.phase.nextOpen).getTime() - now)}` : "regular session"}
          hint="Nasdaq and NYSE trade 9:30 to 16:00 New York time on weekdays. Outside that, tokenized stocks on Solana are the only place these shares change hands."
        />
        <StatCard
          index={1}
          icon={Activity}
          label="Trading onchain"
          href="/stocks"
          value={<CountUp value={data.rows.length} kind="int" />}
          detail="stocks with real liquidity"
          badge={<span className="pill pill-blue">24/7</span>}
          hint="We list a stock only when at least 50k USD sits in its onchain pools. Thin tokens are hidden, not decorated."
        />
        <StatCard
          index={2}
          icon={TrendingUp}
          label="Biggest move"
          href={top ? `/stock/${top.underlying}` : "/stocks"}
          value={top ? top.name : "–"}
          badge={top && <span className={`pill ${(top.gapPct ?? 0) >= 0 ? "pill-dark" : "bg-soft-down text-down"}`}>{formatPct(top.gapPct)}</span>}
          detail={top ? `vs ${data.reference.phrase}` : undefined}
        />
        <StatCard
          index={3}
          icon={CalendarDays}
          label="Next earnings"
          href="/earnings"
          value={nextEarnings ? nextEarnings.name : "–"}
          detail={
            nextEarnings
              ? `${earningsDate.format(new Date(`${nextEarnings.date}T12:00:00Z`))}, ${nextEarnings.timing}`
              : "none scheduled"
          }
        />
      </div>

      <div className="rise" style={{ "--i": 4 } as React.CSSProperties}>
        <GlobeHero phase={data.phase} stockCount={data.rows.length} generatedAt={data.generatedAt} />
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <section className="card rise p-5 lg:col-span-5" style={{ "--i": 5 } as React.CSSProperties}>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-semibold">Moved most</h2>
            <span className="text-muted text-xs">since {data.reference.phrase}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {movers.map((m) => (
              <TrendCard key={m.underlying} row={m} />
            ))}
          </div>
        </section>

        <section className="card rise p-5 lg:col-span-7" style={{ "--i": 6 } as React.CSSProperties}>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-semibold">Trading now</h2>
            <Link href="/stocks" className="text-muted text-sm hover:text-ink">
              View all {data.rows.length}
            </Link>
          </div>
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.underlying}>
                <Link href={`/stock/${r.underlying}`} className="flex items-center gap-3 py-3 transition hover:opacity-80">
                  <TickerBadge symbol={r.symbol} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.name}</span>
                    <span className="text-muted block text-xs">
                      {r.symbol} · {r.issuerName}
                    </span>
                  </span>
                  <span className={`pill hidden sm:inline-flex ${PILL[r.tradability]}`}>{TRADABILITY_LABEL[r.tradability]}</span>
                  <span className="text-right">
                    <span className="num block text-sm font-semibold">
                      {r.price == null ? "–" : <CountUp value={r.price} from={0.9} kind="usd" />}
                    </span>
                    <span className={`num block text-xs ${tone(r.gapPct)}`}>{formatPct(r.gapPct)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function tone(gap: number | null): string {
  if (gap == null || Math.abs(gap) < 0.25) return "text-muted";
  return gap > 0 ? "text-up" : "text-down";
}
