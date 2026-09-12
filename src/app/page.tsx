import Link from "next/link";
import { Clock, Activity, TrendingUp, CalendarDays } from "lucide-react";
import { GlobeHero } from "@/components/globe-hero";
import { StatCard } from "@/components/stat-card";
import { TrendCard } from "@/components/trend-card";
import { TickerBadge } from "@/components/ticker-badge";
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
  const rows = data.rows.slice(0, 8);
  const movers = [...data.rows]
    .filter((r) => r.gapPct != null && r.spark.length > 2)
    .sort((a, b) => Math.abs(b.gapPct ?? 0) - Math.abs(a.gapPct ?? 0))
    .slice(0, 3);
  const top = movers[0];
  const nextEarnings = data.earnings[0];
  const closed = data.phase.phase !== "open";

  return (
    <div className="flex flex-col gap-5">
      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Clock}
          label="Wall Street"
          value={closed ? "Closed" : "Open"}
          detail={closed ? `opens in ${formatDuration(new Date(data.phase.nextOpen).getTime() - now)}` : "regular session"}
        />
        <StatCard
          icon={Activity}
          label="Trading onchain"
          value={data.rows.length}
          detail="stocks, right now"
          badge={<span className="pill pill-blue">24/7</span>}
        />
        <StatCard
          icon={TrendingUp}
          label="Biggest move"
          value={top ? top.name : "–"}
          badge={
            top && (
              <span className={`pill ${(top.gapPct ?? 0) >= 0 ? "pill-dark" : "bg-soft-down text-down"}`}>
                {formatPct(top.gapPct)}
              </span>
            )
          }
          detail={top ? `vs ${data.reference.phrase}` : undefined}
        />
        <StatCard
          icon={CalendarDays}
          label="Next earnings"
          value={nextEarnings ? nextEarnings.name : "–"}
          detail={nextEarnings ? `${earningsDate.format(new Date(`${nextEarnings.date}T12:00:00Z`))}, ${nextEarnings.timing}` : "none scheduled"}
        />
      </div>

      {/* The night panel with the globe */}
      <GlobeHero phase={data.phase} stockCount={data.rows.length} generatedAt={data.generatedAt} />

      {/* Trending + list */}
      <div className="grid gap-5 lg:grid-cols-12">
        <section className="card p-5 lg:col-span-5">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-semibold">Moved most</h2>
            <span className="text-muted text-xs">since {data.reference.phrase}</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {movers.map((m) => (
              <TrendCard key={m.underlying} row={m} />
            ))}
          </div>
        </section>

        <section className="card p-5 lg:col-span-7">
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
                    <span className="num block text-sm font-semibold">{formatUsd(r.price)}</span>
                    <span className={`num block text-xs ${tone(r.gapPct)}`}>{formatPct(r.gapPct)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* How it works + rules */}
      <div id="how" className="grid gap-5 lg:grid-cols-12">
        <section className="card p-6 lg:col-span-7">
          <h2 className="font-semibold">How it works</h2>
          <div className="mt-4 grid gap-6 sm:grid-cols-3">
            <Step title="Pick a stock">
              Tesla, Nvidia, the S&amp;P 500 and {Math.max(0, data.rows.length - 3)} more, each issued by a
              regulated company and backed one to one by a real share. We say which issuer wraps it how.
            </Step>
            <Step title="Check the price is real">
              Every price carries the time of its last trade, the depth of the pool behind it, and its distance
              from the last Wall Street print. Stale is labeled stale, thin is labeled thin.
            </Step>
            <Step title="Buy from your wallet">
              Enter an amount, get a real quote including price impact and a plain verdict on whether now is a
              fair moment. Sign in Phantom, Backpack or Solflare. The swap runs through Jupiter.
            </Step>
          </div>
        </section>
        <section className="card-dark p-6 lg:col-span-5">
          <h2 className="font-semibold">What we will not do</h2>
          <ul className="text-on-dark-muted mt-4 space-y-2.5 text-sm leading-relaxed">
            <li>Hold your money. Every trade is signed in your wallet.</li>
            <li>List a token with less than 50k USD of real liquidity.</li>
            <li>Call a price fresh when it last traded an hour ago.</li>
            <li>Call a weekend drift an opportunity. It is a drift.</li>
            <li>Pretend a pre-IPO token is a share. Those are not listed.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-muted mt-1.5 text-sm leading-relaxed">{children}</p>
    </div>
  );
}

function tone(gap: number | null): string {
  if (gap == null || Math.abs(gap) < 0.25) return "text-muted";
  return gap > 0 ? "text-up" : "text-down";
}
