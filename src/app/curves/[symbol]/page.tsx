import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { curvesForStock } from "@/lib/curves";
import { TRADABILITY_LABEL, type Tradability } from "@/lib/radar-types";
import { formatAgo, formatUsd } from "@/lib/format";
import { CurveShape } from "@/components/curve-shape";
import { PoolRow, compactUsd, units } from "@/components/curve-pool-row";
import { TickerBadge } from "@/components/ticker-badge";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ symbol: string }> };

const PILL: Record<Tradability, string> = {
  easy: "bg-soft-up text-up",
  ok: "bg-soft text-ink",
  thin: "bg-soft-warn text-warn",
  stale: "bg-soft-warn text-warn",
  none: "bg-soft text-muted",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { symbol } = await params;
  const s = await curvesForStock(symbol);
  if (!s) return { title: "Curves" };
  return {
    title: `${s.name} curves`,
    description: `${s.pools.length} Meteora bonding curves priced in ${s.symbol}: ${s.live} live, ${s.graduated} graduated, ${compactUsd(s.raisedUsd)} in curves.`,
    alternates: { canonical: `/curves/${s.underlying}` },
    robots: { index: false, follow: true },
  };
}

export default async function StockCurvesPage({ params }: Props) {
  const { symbol } = await params;
  const s = await curvesForStock(symbol);
  if (!s) notFound();
  const live = s.pools.filter((p) => !p.migrated && p.progress > 0);
  const graduated = s.pools.filter((p) => p.migrated);
  const idle = s.pools.length - live.length - graduated.length;
  const doubtful =
    s.tradability === "stale" ||
    s.tradability === "thin" ||
    s.tradability === "none";
  const leader = live[0] ?? null;

  return (
    <div className="flex flex-col gap-5">
      <section className="card-dark overflow-hidden p-6 sm:p-8">
        <Link
          href="/curves"
          className="text-on-dark-muted inline-flex items-center gap-1 text-sm hover:text-white"
        >
          <ArrowLeft size={14} strokeWidth={1.75} /> Curves
        </Link>
        <div className="mt-3 grid items-center gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="flex items-center gap-4">
              <TickerBadge symbol={s.symbol} logo={s.logo} size={64} />
              <div className="min-w-0">
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  {s.name}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-on-dark-muted text-sm">{s.symbol}</span>
                  <span className={`pill ${PILL[s.tradability]}`}>
                    {TRADABILITY_LABEL[s.tradability]}
                  </span>
                  <span className="text-on-dark-muted num text-xs">
                    {s.price != null
                      ? `${formatUsd(s.price)} onchain`
                      : "no price"}
                    {s.ageMs != null ? `, ${formatAgo(s.ageMs)}` : ""}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-on-dark-muted mt-4 max-w-xl leading-relaxed">
              {s.pools.length} tokens have been launched on curves priced in{" "}
              {s.symbol}. Buyers on those curves pay in {s.symbol}; every dollar
              figure on this page is that stock&apos;s onchain price applied to
              what sits in the curve.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href={`/curves/build?stock=${s.mint}`}
                className="btn btn-white"
              >
                Build a curve priced in {s.symbol}{" "}
                <ArrowRight size={16} strokeWidth={2} className="ml-1.5" />
              </Link>
              <Link
                href={`/stock/${s.underlying}`}
                className="text-on-dark-muted text-sm hover:text-white"
              >
                {s.symbol} stock page
              </Link>
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="num grid grid-cols-3 gap-3">
              <Stat label="Live" value={String(s.live)} />
              <Stat label="Graduated" value={String(s.graduated)} />
              <Stat label="In curves" value={compactUsd(s.raisedUsd)} />
            </div>
            {leader && (
              <div className="text-on-dark-muted mt-3">
                <CurveShape
                  startLabel="start"
                  endLabel="graduation"
                  raiseLabel={`${leader.name}: ${Math.round(leader.progress * 100)}% there`}
                  ratio={10}
                  fill="#8fb3ff"
                  progress={leader.progress}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {doubtful && (
        <p className="card text-warn p-4 text-sm">
          {s.tradability === "stale"
            ? `${s.symbol} has not traded onchain for over an hour, so the dollar values here are guesses until it does.`
            : `${s.symbol}'s onchain market is thin; dollar values here are approximate.`}
        </p>
      )}

      {live.length > 0 && (
        <section className="card p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-semibold">Live, by progress</h3>
            <span className="text-muted num text-xs">
              {live.length} curves · {units(s.raisedQuote, s.symbol)} in them
            </span>
          </div>
          <ul className="mt-2 divide-y divide-line">
            {live.slice(0, 20).map((p) => (
              <PoolRow key={p.pool} p={p} symbol={s.symbol} />
            ))}
          </ul>
          {live.length > 20 && (
            <details className="group mt-2">
              <summary className="btn btn-sm mx-auto flex w-fit cursor-pointer list-none border border-line bg-card text-ink hover:bg-soft [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">
                  Show {live.length - 20} more
                </span>
                <span className="hidden group-open:inline">Show fewer</span>
              </summary>
              <ul className="mt-2 divide-y divide-line">
                {live.slice(20).map((p) => (
                  <PoolRow key={p.pool} p={p} symbol={s.symbol} />
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      {graduated.length > 0 && (
        <section className="card p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-semibold">Graduated</h3>
            <span className="text-muted text-xs">
              the curve filled and the liquidity moved to a DAMM v2 pool
            </span>
          </div>
          <ul className="mt-2 divide-y divide-line">
            {graduated.map((p) => (
              <PoolRow key={p.pool} p={p} symbol={s.symbol} />
            ))}
          </ul>
        </section>
      )}

      {idle > 0 && (
        <p className="text-muted text-center text-xs">
          {idle} more pools priced in {s.symbol} exist, but nothing has been
          bought on them.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3 text-center">
      <div className="text-on-dark-muted text-xs">{label}</div>
      <div className="mt-0.5 text-2xl font-semibold">{value}</div>
    </div>
  );
}
