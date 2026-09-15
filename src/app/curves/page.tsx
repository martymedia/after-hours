import type { Metadata } from "next";
import Link from "next/link";
import { Orbit, Rocket, GraduationCap, Coins } from "lucide-react";
import { curvesOverview, type CurvePool, type CurveStock } from "@/lib/curves";
import { TRADABILITY_LABEL, type Tradability } from "@/lib/radar-types";
import { formatAgo, formatUsd } from "@/lib/format";
import { StatCard } from "@/components/stat-card";
import { TickerBadge } from "@/components/ticker-badge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Curves",
  description:
    "Meteora bonding-curve launches priced in tokenized stocks: progress to graduation, what each has raised, and whether the stock underneath is fresh.",
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
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
});

/** Launch-token prices are tiny; three significant digits read better than a fixed scale. */
function tinyUsd(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "–";
  if (v >= 1) return formatUsd(v);
  return `$${v.toPrecision(3).replace(/e-?\d+$/, (e) => e)}`;
}
function units(v: number, symbol: string): string {
  const n = v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(2) : v.toFixed(4);
  return `${n} ${symbol}`;
}

export default async function CurvesPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  const { all } = await searchParams;
  const showAll = all === "1";
  const data = await curvesOverview();
  const t = data.totals;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight lg:hidden">
            Curves
          </h2>
          <p className="text-muted mt-1 max-w-2xl">
            Tokens launched on Meteora bonding curves and priced in a tokenized
            stock instead of SOL. Every pool below uses one of the stocks we
            track as its quote token. USD values come from that stock&apos;s
            onchain price, the same one the rest of this site shows.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/curves/build" className="btn btn-sm">
            Build a curve
          </Link>
          <p className="text-muted num text-xs">
            {data.scannedAgoMs != null
              ? `Scanned ${formatAgo(data.scannedAgoMs)} · live pools refreshed every 2 min`
              : "First scan pending"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
        <StatCard
          icon={Orbit}
          label="Pools"
          value={String(t.pools)}
          detail={`${t.configs} configs, ${t.stocksUsed} stocks used as quote`}
          hint="Every Meteora DBC pool whose quote token is a tokenized stock we track. Found by scanning the program's configs for those mints."
          index={0}
        />
        <StatCard
          icon={Rocket}
          label="Live"
          value={String(t.live)}
          detail="raised something, not graduated"
          hint="Pools with quote tokens in the curve that have not migrated to a DAMM v2 pool yet."
          index={1}
        />
        <StatCard
          icon={GraduationCap}
          label="Graduated"
          value={String(t.graduated)}
          detail="migrated to a DAMM v2 pool"
          hint="The curve hit its migration threshold and the liquidity moved to a regular Meteora pool."
          index={2}
        />
        <StatCard
          icon={Coins}
          label="Raised"
          value={formatUsd(t.raisedUsd, 0)}
          detail={`${formatUsd(t.feesUsd, 0)} in trading fees`}
          hint="Quote tokens sitting in live curves, valued at the stock's current onchain price. Graduated pools moved their quote out, so they count zero here."
          index={3}
        />
      </div>

      {data.stocks.length === 0 ? (
        <section className="card p-6">
          <p className="font-medium">No pools yet.</p>
          <p className="text-muted mt-1 text-sm">
            The collector scans Meteora every 30 minutes; the first pass takes a
            few minutes.
          </p>
        </section>
      ) : (
        data.stocks.map((s) => (
          <StockSection key={s.mint} s={s} showAll={showAll} />
        ))
      )}

      <section className="card p-5">
        <h3 className="font-semibold">What this is, and is not</h3>
        <ul className="text-muted mt-2 space-y-1.5 text-sm">
          <li>
            A monitor, read straight from the Dynamic Bonding Curve program. We
            do not list, rate or sell these tokens, and none of them is a stock.
          </li>
          <li>
            USD figures inherit the doubt of the stock underneath: if the
            stock&apos;s onchain price is stale or thin, the pool&apos;s USD
            values are too. The pill on each stock says which.
          </li>
          <li>
            Progress is quote raised against the config&apos;s migration
            threshold. Graduated pools moved their liquidity to a DAMM v2 pool;
            their raised amount no longer sits in the curve.
          </li>
          <li>
            Names and images are the launch tokens&apos; own metadata, shown as
            found.
          </li>
        </ul>
      </section>
    </div>
  );
}

function StockSection({ s, showAll }: { s: CurveStock; showAll: boolean }) {
  const LIMIT = 8;
  const shown = showAll ? s.pools : s.pools.slice(0, LIMIT);
  const hidden = s.pools.length - shown.length;
  const doubtful =
    s.tradability === "stale" ||
    s.tradability === "thin" ||
    s.tradability === "none";
  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/stock/${s.underlying}`}
          className="transition hover:opacity-80"
          aria-label={`${s.name} stock page`}
        >
          <TickerBadge symbol={s.symbol} logo={s.logo} size={40} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{s.name}</h3>
            <span className="text-muted text-xs">{s.symbol}</span>
            <span className={`pill ${PILL[s.tradability]}`}>
              {TRADABILITY_LABEL[s.tradability]}
            </span>
          </div>
          <p className="text-muted num text-xs">
            {s.pools.length} pools · {s.live} live · {s.graduated} graduated ·
            raised {units(s.raisedQuote, s.symbol)}
            {s.price != null ? ` ≈ ${formatUsd(s.raisedUsd, 0)}` : ""} · stock{" "}
            {s.price != null ? formatUsd(s.price) : "–"} onchain
            {s.ageMs != null ? `, ${formatAgo(s.ageMs)}` : ""}
          </p>
        </div>
      </div>
      {doubtful && (
        <p className="text-warn mt-3 text-xs">
          {s.tradability === "stale"
            ? "This stock's onchain price is over an hour old, so the USD values here are guesses until it trades again."
            : "This stock's onchain market is thin; USD values here are approximate."}
        </p>
      )}
      <ul className="mt-4 divide-y divide-line">
        {shown.map((p) => (
          <PoolRow key={p.pool} p={p} symbol={s.symbol} />
        ))}
      </ul>
      {hidden > 0 && (
        <Link
          href="/curves?all=1"
          className="text-muted mt-3 inline-block text-xs underline underline-offset-4 hover:text-ink"
        >
          and {hidden} more with nothing raised yet
        </Link>
      )}
    </section>
  );
}

function PoolRow({ p, symbol }: { p: CurvePool; symbol: string }) {
  const pct = Math.round(p.progress * 100);
  return (
    <li className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-3 py-3 sm:grid-cols-[2.25rem_minmax(0,1.4fr)_minmax(0,1fr)_auto]">
      {p.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={p.image}
          alt=""
          className="h-9 w-9 rounded-full bg-soft object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="icon-badge h-9 w-9 text-xs font-semibold">
          {(p.symbol ?? (p.name.startsWith("(") ? "?" : p.name))
            .slice(0, 2)
            .toUpperCase()}
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">
          {p.name}
          {p.symbol && (
            <span className="text-muted ml-1.5 text-xs font-normal">
              {p.symbol}
            </span>
          )}
        </span>
        <span className="text-muted num block text-xs">
          {p.migrated
            ? `graduated${p.finishedAt ? ` ${when.format(new Date(p.finishedAt))} ET` : ""}`
            : `raised ${units(p.raisedQuote, symbol)}${p.raisedUsd != null ? ` ≈ ${formatUsd(p.raisedUsd)}` : ""}`}
          {p.feesQuote > 0 ? ` · fees ${units(p.feesQuote, symbol)}` : ""}
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
          <span className="num w-10 text-right text-xs">{pct}%</span>
        </span>
        <span className="text-muted num block text-xs">
          {p.migrated
            ? "curve complete"
            : `token ${tinyUsd(p.priceUsd)}${p.priceQuote != null ? ` (${p.priceQuote.toPrecision(3)} ${symbol})` : ""}`}
        </span>
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
