import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { curvesOverview, type CurvePool, type CurveStock } from "@/lib/curves";
import { TRADABILITY_LABEL, type Tradability } from "@/lib/radar-types";
import { formatAgo, formatUsd } from "@/lib/format";
import { TickerBadge } from "@/components/ticker-badge";

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

const when = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "America/New_York",
});

function tinyUsd(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "–";
  return v >= 1 ? formatUsd(v) : `$${v.toPrecision(3)}`;
}
function units(v: number, symbol: string): string {
  const n = v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(2) : v.toFixed(3);
  return `${n} ${symbol}`;
}
function compact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return formatUsd(n, 0);
}

export default async function CurvesPage() {
  const data = await curvesOverview();
  const t = data.totals;
  const top = data.stocks.slice(0, 8);
  // Only stocks with something happening get a fold; idle ones are one line.
  const active = data.stocks.filter((s) => s.live > 0 || s.graduated > 0);
  const idleStocks = data.stocks.length - active.length;
  const maxRaised = Math.max(1, ...top.map((s) => s.raisedUsd));

  return (
    <div className="flex flex-col gap-5">
      {/* What this is, in one look */}
      <section className="card-dark overflow-hidden p-6 sm:p-8">
        <div className="grid items-center gap-8 lg:grid-cols-12">
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
              <a
                href="#live"
                className="text-on-dark-muted text-sm hover:text-white"
              >
                See what is live
              </a>
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
                value={compact(t.raisedUsd)}
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

      {/* Which stocks carry the launches */}
      {top.length > 0 && (
        <section id="live" className="card p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-semibold">Where the curves are</h3>
            <span className="text-muted text-xs">
              stock tokens in live curves, by value
            </span>
          </div>
          <ul className="mt-4 space-y-2.5">
            {top.map((s) => (
              <li
                key={s.mint}
                className="grid grid-cols-[2rem_5.5rem_1fr_auto] items-center gap-3 text-sm"
              >
                <TickerBadge symbol={s.symbol} logo={s.logo} size={28} />
                <a
                  href={`#stock-${s.underlying}`}
                  className="truncate font-medium hover:underline"
                >
                  {s.symbol}
                </a>
                <span className="h-2 overflow-hidden rounded-full bg-soft">
                  <span
                    className="block h-full rounded-full bg-blue"
                    style={{
                      width: `${Math.max(2, (s.raisedUsd / maxRaised) * 100)}%`,
                    }}
                  />
                </span>
                <span className="num text-muted text-right text-xs">
                  {compact(s.raisedUsd)} · {s.live} live
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Every stock, folded */}
      {data.stocks.length === 0 ? (
        <section className="card p-6">
          <p className="font-medium">No pools yet.</p>
          <p className="text-muted mt-1 text-sm">
            The first scan is running; it takes a few minutes.
          </p>
        </section>
      ) : (
        <section className="card p-2 sm:p-3">
          {active.map((s, i) => (
            <StockFold key={s.mint} s={s} open={i === 0} />
          ))}
          {idleStocks > 0 && (
            <p className="text-muted px-3 py-3 text-xs">
              {idleStocks} more stocks have pools where nothing has been bought
              yet.
            </p>
          )}
        </section>
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

function StockFold({ s, open }: { s: CurveStock; open: boolean }) {
  const live = s.pools.filter((p) => !p.migrated && p.progress > 0);
  const graduated = s.pools.filter((p) => p.migrated);
  const idle = s.pools.length - live.length - graduated.length;
  const shown = [...graduated.slice(0, 3), ...live.slice(0, 6)];
  const doubtful =
    s.tradability === "stale" ||
    s.tradability === "thin" ||
    s.tradability === "none";
  return (
    <details
      id={`stock-${s.underlying}`}
      open={open}
      className="group border-b border-line last:border-0"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl px-2 py-3 hover:bg-soft sm:px-3 [&::-webkit-details-marker]:hidden">
        <TickerBadge symbol={s.symbol} logo={s.logo} size={36} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{s.name}</span>
            <span className="text-muted text-xs">{s.symbol}</span>
            <span className={`pill ${PILL[s.tradability]}`}>
              {TRADABILITY_LABEL[s.tradability]}
            </span>
          </span>
          <span className="text-muted num block text-xs">
            {live.length} live · {graduated.length} graduated ·{" "}
            {compact(s.raisedUsd)} in curves
          </span>
        </span>
        <span className="hidden items-center gap-1 sm:flex" aria-hidden="true">
          {live.slice(0, 5).map((p) => (
            <span
              key={p.pool}
              className="h-1.5 w-8 overflow-hidden rounded-full bg-soft"
            >
              <span
                className="block h-full bg-blue"
                style={{ width: `${Math.max(3, p.progress * 100)}%` }}
              />
            </span>
          ))}
        </span>
        <span className="text-muted-2 text-lg leading-none transition group-open:rotate-90">
          ›
        </span>
      </summary>
      <div className="px-2 pb-3 sm:px-3">
        {doubtful && (
          <p className="text-warn mb-2 text-xs">
            {s.tradability === "stale"
              ? "Stock price over an hour old; USD values here are guesses until it trades."
              : "Thin stock market; USD values are approximate."}
          </p>
        )}
        {shown.length === 0 ? (
          <p className="text-muted text-sm">
            Pools exist, but nothing has been bought on any of them yet.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((p) => (
              <PoolRow key={p.pool} p={p} symbol={s.symbol} />
            ))}
          </ul>
        )}
        {(live.length > 6 || graduated.length > 3 || idle > 0) && (
          <p className="text-muted mt-2 text-xs">
            {live.length > 6 ? `${live.length - 6} more live, ` : ""}
            {graduated.length > 3
              ? `${graduated.length - 3} more graduated, `
              : ""}
            {idle > 0 ? `${idle} pools with nothing raised.` : ""}
          </p>
        )}
      </div>
    </details>
  );
}

function PoolRow({ p, symbol }: { p: CurvePool; symbol: string }) {
  const pct = Math.round(p.progress * 100);
  return (
    <li className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 py-2.5 text-sm sm:grid-cols-[2rem_minmax(0,1.3fr)_minmax(0,1fr)_auto]">
      {p.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={p.image}
          alt=""
          className="h-8 w-8 rounded-full bg-soft object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="icon-badge h-8 w-8 text-[10px] font-semibold">
          {(p.symbol ?? (p.name.startsWith("(") ? "?" : p.name))
            .slice(0, 2)
            .toUpperCase()}
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate font-medium">
          {p.name}
          {p.symbol && (
            <span className="text-muted ml-1.5 text-xs font-normal">
              {p.symbol}
            </span>
          )}
        </span>
        <span className="text-muted num block text-xs">
          {p.migrated
            ? `graduated${p.finishedAt ? ` ${when.format(new Date(p.finishedAt))}` : ""}`
            : `${units(p.raisedQuote, symbol)}${p.raisedUsd != null ? ` ≈ ${formatUsd(p.raisedUsd, 0)}` : ""} raised`}
        </span>
      </span>
      <span className="col-span-3 sm:col-span-1">
        <span className="flex items-center gap-2">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-soft">
            <span
              className={`block h-full rounded-full ${p.migrated ? "bg-ink" : "bg-blue"}`}
              style={{ width: `${Math.max(1, pct)}%` }}
            />
          </span>
          <span className="num w-9 text-right text-xs">{pct}%</span>
        </span>
        {!p.migrated && (
          <span className="text-muted num block text-xs">
            token at {tinyUsd(p.priceUsd)}
          </span>
        )}
      </span>
      <a
        href={`https://solscan.io/account/${p.pool}`}
        target="_blank"
        rel="noreferrer"
        className="text-muted-2 hover:text-ink text-xs"
      >
        Solscan
      </a>
    </li>
  );
}
