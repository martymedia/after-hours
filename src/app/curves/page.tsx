import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { curvesOverview, type CurveStock } from "@/lib/curves";
import { TRADABILITY_LABEL, type Tradability } from "@/lib/radar-types";
import { formatAgo } from "@/lib/format";
import { PoolMini, compactUsd } from "@/components/curve-pool-row";
import { TickerBadge } from "@/components/ticker-badge";
import { CurveField } from "@/components/curve-field";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Curves",
  description:
    "Tokens launched on Meteora bonding curves and priced in tokenized stocks: what is live, what graduated, what each raised. Plus a builder for your own.",
  alternates: { canonical: "/curves" },
};

const PILL: Record<Tradability, string> = {
  easy: "bg-soft-up text-up",
  ok: "bg-soft text-ink",
  thin: "bg-soft-warn text-warn",
  stale: "bg-soft-warn text-warn",
  none: "bg-soft text-muted",
};

export default async function CurvesPage() {
  const data = await curvesOverview();
  const t = data.totals;
  const active = data.stocks.filter((s) => s.live > 0 || s.graduated > 0);
  const front = active.slice(0, 9);
  const rest = active.slice(9);
  const idleStocks = data.stocks.length - active.length;

  return (
    <div className="flex flex-col gap-5">
      <section className="card-dark relative overflow-hidden p-6 sm:p-8">
        <CurveField />
        <div className="relative grid items-center gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p className="text-blue-light text-sm font-medium">Curves</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Tokens launched on a curve, priced in a stock instead of SOL.
            </h2>
            <p className="text-on-dark-muted mt-3 max-w-xl leading-relaxed">
              On Meteora, a new token can be sold along a bonding curve whose
              quote is a tokenized stock. Buyers pay in TSLAx or SPYx, the price
              climbs with every buy, and once a set amount is raised the pool
              graduates to a normal market. This page watches every such curve,
              and lets you launch one anchored to the stock&apos;s real price.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link href="/curves/build" className="btn btn-white">
                Build your own curve{" "}
                <ArrowRight size={16} strokeWidth={2} className="ml-1.5" />
              </Link>
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="num grid grid-cols-2 gap-3">
              <Stat
                label="Live curves"
                value={String(t.live)}
                note="raising right now"
              />
              <Stat
                label="Graduated"
                value={String(t.graduated)}
                note="moved to open pools"
              />
              <Stat
                label="In curves"
                value={compactUsd(t.raisedUsd)}
                note="of stock tokens, at today's prices"
              />
              <Stat
                label="Stocks used"
                value={String(t.stocksUsed)}
                note={`${t.pools} pools overall`}
              />
            </div>
            <p className="text-on-dark-muted num mt-2 text-right text-[11px]">
              {data.scannedAgoMs != null
                ? `scanned ${formatAgo(data.scannedAgoMs)}, live pools every 2 min`
                : "first scan pending"}
            </p>
          </div>
        </div>
      </section>

      {front.length === 0 ? (
        <section className="card p-6">
          <p className="font-medium">No pools yet.</p>
          <p className="text-muted mt-1 text-sm">
            The first scan is running; it takes a few minutes.
          </p>
        </section>
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {front.map((s, i) => (
              <StockCard key={s.mint} s={s} index={i} />
            ))}
          </div>
          {rest.length > 0 && (
            <details className="group">
              <summary className="btn btn-sm mx-auto flex w-fit cursor-pointer list-none border border-line bg-card text-ink hover:bg-soft [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">
                  Show {rest.length} more stocks
                </span>
                <span className="hidden group-open:inline">Show fewer</span>
              </summary>
              <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {rest.map((s, i) => (
                  <StockCard key={s.mint} s={s} index={i} />
                ))}
              </div>
            </details>
          )}
          {idleStocks > 0 && (
            <p className="text-muted text-center text-xs">
              {idleStocks} more stocks have pools where nothing has been bought
              yet.
            </p>
          )}
        </>
      )}

      <details className="card p-5">
        <summary className="cursor-pointer font-semibold">
          How to read this
        </summary>
        <ul className="text-muted mt-3 space-y-1.5 text-sm">
          <li>
            Progress is the quote raised against the curve&apos;s migration
            threshold. At 100% the liquidity moves to a DAMM v2 pool and the
            token trades like any other.
          </li>
          <li>
            USD values use the stock&apos;s onchain price from this site. A
            stale or thin stock makes them approximate, and its pill says so.
          </li>
          <li>
            We read the Dynamic Bonding Curve program directly. Nothing here is
            listed, rated or sold by us, and none of these tokens is a stock.
          </li>
        </ul>
      </details>
    </div>
  );
}

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl bg-white/10 p-3">
      <div className="text-on-dark-muted text-xs">{label}</div>
      <div className="mt-0.5 text-2xl font-semibold">{value}</div>
      <div className="text-on-dark-muted text-[11px]">{note}</div>
    </div>
  );
}

function StockCard({ s, index }: { s: CurveStock; index: number }) {
  const top = s.pools
    .filter((p) => !p.migrated && p.progress > 0)
    .sort(
      (a, b) => Number(a.name.startsWith("(")) - Number(b.name.startsWith("(")),
    )
    .slice(0, 3);
  const total = s.live + s.graduated;
  const style = {
    animationDelay: `${Math.min(index, 8) * 40}ms`,
  } as React.CSSProperties;
  return (
    <section className="card rise flex flex-col p-5" style={style}>
      <div className="flex items-start gap-3">
        <Link
          href={`/curves/${s.underlying}`}
          aria-label={`${s.name} curves`}
          className="transition hover:opacity-80"
        >
          <TickerBadge symbol={s.symbol} logo={s.logo} size={52} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={`/curves/${s.underlying}`}
            className="block truncate text-lg leading-tight font-semibold hover:underline"
          >
            {s.name}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-muted text-xs">{s.symbol}</span>
            <span className={`pill ${PILL[s.tradability]}`}>
              {TRADABILITY_LABEL[s.tradability]}
            </span>
          </div>
        </div>
      </div>
      <dl className="num mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-soft px-2 py-2">
          <dt className="text-muted text-[11px]">Live</dt>
          <dd className="text-lg font-semibold">{s.live}</dd>
        </div>
        <div className="rounded-2xl bg-soft px-2 py-2">
          <dt className="text-muted text-[11px]">Graduated</dt>
          <dd className="text-lg font-semibold">{s.graduated}</dd>
        </div>
        <div className="rounded-2xl bg-soft px-2 py-2">
          <dt className="text-muted text-[11px]">In curves</dt>
          <dd className="text-lg font-semibold">{compactUsd(s.raisedUsd)}</dd>
        </div>
      </dl>
      <ul className="mt-4 flex-1 space-y-2.5">
        {top.map((p) => (
          <PoolMini key={p.pool} p={p} symbol={s.symbol} />
        ))}
      </ul>
      <Link
        href={`/curves/${s.underlying}`}
        className="text-blue mt-4 inline-flex items-center gap-1 text-sm font-medium hover:underline"
      >
        View all {total} curves <ArrowRight size={14} strokeWidth={2} />
      </Link>
    </section>
  );
}
