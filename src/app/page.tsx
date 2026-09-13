import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Activity, TrendingUp, CalendarDays } from "lucide-react";
import { GlobeHero } from "@/components/globe-hero";
import { StatCard } from "@/components/stat-card";
import { TrendCard } from "@/components/trend-card";
import { TickerBadge } from "@/components/ticker-badge";
import { CountUp } from "@/components/count-up";
import { getRadar } from "@/lib/radar";
import { formatDuration, formatPct, gapIsOutlier, gapSentence, gapTone, gapWords } from "@/lib/format";
import { TRADABILITY_LABEL, type Tradability } from "@/lib/radar-types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "After Hours: trade stocks when Wall Street sleeps" },
  description:
    "Which tokenized stocks trade on Solana right now, whether the onchain price is fresh, how far it drifts from the last Wall Street print, and what a buy really costs. Then buy from your own wallet.",
  alternates: { canonical: "/" },
};

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
  // Rankings only use stocks with a real market and a gap that is a signal,
  // not a one-off trade far from the reference.
  const withGap = data.rows.filter(
    (r) => r.gapPct != null && !gapIsOutlier(r.gapPct) && r.spark.length > 2 && (r.tradability === "easy" || r.tradability === "ok"),
  );
  const cheaper = [...withGap].filter((r) => (r.gapPct ?? 0) < 0).sort((a, b) => (a.gapPct ?? 0) - (b.gapPct ?? 0)).slice(0, 3);
  const pricier = [...withGap].filter((r) => (r.gapPct ?? 0) > 0).sort((a, b) => (b.gapPct ?? 0) - (a.gapPct ?? 0)).slice(0, 3);
  // Lead with the best discount when there is one; a premium is only news
  // when nothing trades cheaper.
  const top = cheaper[0] ?? [...withGap].sort((a, b) => Math.abs(b.gapPct ?? 0) - Math.abs(a.gapPct ?? 0))[0];
  const nextEarnings = data.earnings[0];
  const closed = data.phase.phase !== "open";

  return (
    <div className="flex flex-col gap-5">
      <div className="order-2 grid grid-cols-2 gap-3 sm:gap-4 lg:order-1 xl:grid-cols-4">
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
          label={top && (top.gapPct ?? 0) < 0 ? "Biggest discount" : "Biggest move"}
          href={top ? `/stock/${top.underlying}` : "/stocks"}
          value={top ? top.name : "–"}
          badge={top && <span className={`pill ${(top.gapPct ?? 0) < 0 ? "pill-blue" : "bg-soft-down text-down"}`}>{formatPct(top.gapPct)}</span>}
          detail={top ? <span className={gapTone(top.gapPct)}>{gapSentence(top.gapPct, data.reference.phrase)}</span> : undefined}
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

      <div className="rise order-1 lg:order-2" style={{ "--i": 4 } as React.CSSProperties}>
        <GlobeHero phase={data.phase} stockCount={data.rows.length} generatedAt={data.generatedAt} />
      </div>

      <div className="order-3 grid gap-5 lg:grid-cols-12">
        <section className="card rise flex flex-col p-5 lg:col-span-5" style={{ "--i": 5 } as React.CSSProperties}>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-semibold">Where the gap is</h2>
            <span className="text-muted text-xs">vs {data.reference.phrase}</span>
          </div>
          <p className="text-blue mb-2 text-xs font-medium">Cheaper onchain than on Wall Street</p>
          <div className="grid flex-1 auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-3">
            {cheaper.map((m) => (
              <TrendCard key={m.underlying} row={m} />
            ))}
            {cheaper.length === 0 && <p className="text-muted col-span-full text-sm">Nothing trades at a discount right now.</p>}
          </div>
          <p className="text-down mt-5 mb-2 text-xs font-medium">Pricier onchain than on Wall Street</p>
          <div className="grid flex-1 auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-3">
            {pricier.map((m) => (
              <TrendCard key={m.underlying} row={m} />
            ))}
            {pricier.length === 0 && <p className="text-muted col-span-full text-sm">Nothing trades at a premium right now.</p>}
          </div>
          <p className="text-muted mt-4 text-xs leading-relaxed">
            A discount is where a buy gets you the stock below the last real print. It can also mean the onchain
            market knows something; check the stock page before you act.
          </p>
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
                  <TickerBadge symbol={r.symbol} logo={r.logo} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.name}</span>
                    <span className="text-muted block text-xs">
                      {r.symbol} · {r.issuerName}
                    </span>
                  </span>
                  <span className="hidden w-44 shrink-0 sm:block">
                    <span className={`pill ${PILL[r.tradability]}`}>{TRADABILITY_LABEL[r.tradability]}</span>
                  </span>
                  <span className="w-28 shrink-0 text-right">
                    <span className="num block text-sm font-semibold">
                      {r.price == null ? "–" : <CountUp value={r.price} from={0.9} kind="usd" />}
                    </span>
                    <span className={`num block text-xs ${gapTone(r.gapPct)}`}>{gapWords(r.gapPct)}</span>
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

