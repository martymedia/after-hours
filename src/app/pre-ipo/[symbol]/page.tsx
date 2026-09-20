import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { getPreIpoCompany, TEST_USD, type PreIpoOther } from "@/lib/pre-ipo";
import {
  formatAgo,
  formatCompactUsd,
  formatPct,
  formatUsd,
  gapTone,
  gapWords,
} from "@/lib/format";
import { TRADABILITY_LABEL, type Tradability } from "@/lib/radar-types";
import { PriceChart } from "@/components/price-chart";
import { TradeCard } from "@/components/trade-card";
import { GapChart } from "@/components/gap-chart";
import { TickerBadge } from "@/components/ticker-badge";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ symbol: string }> };

/** The issuer's mark, named so nobody mistakes it for an exchange price. */
const MARK = "the PreStocks mark";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { symbol } = await params;
  const c = await getPreIpoCompany(symbol);
  if (!c) return { title: "Not found", robots: { index: false } };
  const line =
    c.price != null && c.premiumPct != null
      ? `${formatUsd(c.price)} onchain, ${gapWords(c.premiumPct)} than the mark PreStocks carries it at, valuing the company at ${formatCompactUsd(c.marketValuation)}.`
      : "";
  const description =
    `${c.name} as a pre-IPO token on Solana. ${line} SPV exposure to a private company, not a share. Buy and sell from your own wallet, around the clock.`
      .replace(/\s+/g, " ")
      .trim();
  const title = `${c.name} pre-IPO`;
  return {
    title,
    description,
    alternates: { canonical: `/pre-ipo/${c.underlying}` },
    openGraph: {
      title: `${title} | After Hours`,
      description,
      url: `/pre-ipo/${c.underlying}`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | After Hours`,
      description,
    },
  };
}

const PILL: Record<Tradability, string> = {
  easy: "bg-soft-up text-up",
  ok: "bg-soft text-ink",
  thin: "bg-soft-warn text-warn",
  stale: "bg-soft-warn text-warn",
  none: "bg-soft text-muted",
};

export default async function PreIpoCompanyPage({ params }: Props) {
  const { symbol } = await params;
  const c = await getPreIpoCompany(symbol);
  if (!c) notFound();
  const now = Date.parse(c.generatedAt);
  const cheaper = (c.premiumPct ?? 0) < 0;

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/pre-ipo"
        className="text-muted hover:text-ink inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft size={15} strokeWidth={1.75} />
        Pre-IPO
      </Link>

      {/* Who the company is, what the market pays, and the way in */}
      <section className="card-dark overflow-hidden p-6 sm:p-8">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="flex items-center gap-3">
              <TickerBadge symbol={c.symbol} logo={c.logo} size={48} />
              <div className="min-w-0">
                <h2 className="truncate text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
                  {c.name}
                </h2>
                <p className="text-on-dark-muted num text-sm">
                  {c.symbol} · {c.issuerName} · private company
                </p>
              </div>
            </div>

            <p className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
              {formatUsd(c.price)}{" "}
              <span className={cheaper ? "text-blue-light" : "text-white/70"}>
                {gapWords(c.premiumPct)}
              </span>
            </p>
            <p className="text-on-dark-muted mt-1">
              than {MARK} of {formatUsd(c.mark)} per token.{" "}
              {c.ageMs == null ? "" : `Last trade ${formatAgo(c.ageMs)}.`}
            </p>

            {/* The company itself, at both numbers */}
            {c.markValuation != null && (
              <div className="mt-5 grid max-w-md grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/10 p-3">
                  <div className="text-on-dark-muted text-xs">
                    The market says
                  </div>
                  <div className="num text-xl font-semibold">
                    {formatCompactUsd(c.marketValuation)}
                  </div>
                </div>
                <div className="rounded-2xl bg-white/10 p-3">
                  <div className="text-on-dark-muted text-xs">
                    {c.issuerName} marks it
                  </div>
                  <div className="num text-xl font-semibold">
                    {formatCompactUsd(c.markValuation)}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span className={`pill ${PILL[c.tradability]}`}>
                {TRADABILITY_LABEL[c.tradability]}
              </span>
              <span className="pill num bg-white/10 text-white">
                {formatCompactUsd(c.liquidity)} in pools
              </span>
              {c.change24hPct != null && (
                <span className="pill num bg-white/10 text-white">
                  {formatPct(c.change24hPct, 1)} in 24h
                </span>
              )}
              {c.impactPct != null && (
                <span className="pill num bg-white/10 text-white">
                  {formatUsd(TEST_USD, 0)} buy costs {c.impactPct.toFixed(2)}%
                </span>
              )}
            </div>
          </div>
          <div className="lg:col-span-5">
            <TradeCard
              mint={c.mint}
              symbol={c.symbol}
              name={c.name}
              logo={c.logo}
              referencePhrase={MARK}
              // A private company has no session; the wording behind "closed"
              // is the careful one, which is the right one here.
              phase="closed"
              ageMs={c.ageMs}
              liquidity={c.liquidity}
              reference={c.mark}
              price={c.price}
              sessionless
              disabled={c.tradability === "none"}
            />
          </div>
        </div>
      </section>

      {/* What the company does, and what the token actually is */}
      <section className="grid gap-4 lg:grid-cols-12">
        {c.about && (
          <div className="card p-5 sm:p-6 lg:col-span-7">
            <h3 className="font-semibold">What {c.name} does</h3>
            <p className="text-muted mt-2 leading-relaxed">{c.about}</p>
            <a
              href={c.issuerPage ?? c.issuerUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-sm mt-4 inline-flex border border-line bg-card text-ink hover:bg-soft"
            >
              {c.name} at {c.issuerName}
              <ArrowUpRight size={14} strokeWidth={2} />
            </a>
          </div>
        )}
        <div className="card p-5 sm:p-6 lg:col-span-5">
          <h3 className="font-semibold">What you are holding</h3>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            {c.tokenNote ?? c.structure}
          </p>
          <p className="text-muted mt-3 text-sm leading-relaxed">
            No ownership, no voting, no dividend, no information rights, and no
            guaranteed buyer. The mark is {c.issuerName}&apos;s own number for
            the SPV, not an exchange price and not a valuation of ours.
          </p>
        </div>
      </section>

      {/* Our own measurement: how the premium moved */}
      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold">The premium, last two days</h3>
          <span className="text-muted text-xs">
            from our own snapshots, every minute
          </span>
        </div>
        <p className="text-muted mt-1 max-w-2xl text-sm">
          How far the onchain price sat from {MARK}. Blue means the market paid
          less than the issuer&apos;s mark, red means more.
        </p>
        <div className="mt-3">
          <GapChart
            series={c.premiumHistory.map((p) => ({
              ts: p.ts,
              gapPct: p.premiumPct,
            }))}
            referencePhrase={MARK}
          />
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold">Price, last seven days</h3>
          <span className="text-muted num text-xs">
            the line is {MARK}, {formatUsd(c.mark)}
          </span>
        </div>
        <PriceChart
          candles={c.candles}
          reference={c.mark}
          referenceLabel="Mark"
          now={now}
          symbol={c.symbol}
          sessions={false}
        />
      </section>

      {/* Where to go next */}
      {c.others.length > 0 && (
        <section className="card p-5 sm:p-6">
          <h3 className="font-semibold">The other companies</h3>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {c.others.map((o) => (
              <OtherRow key={o.underlying} o={o} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function OtherRow({ o }: { o: PreIpoOther }) {
  return (
    <li>
      <Link
        href={`/pre-ipo/${o.underlying}`}
        className="flex min-w-0 items-center gap-2.5 rounded-2xl p-2 transition hover:bg-soft"
      >
        <TickerBadge symbol={o.symbol} logo={o.logo} size={30} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {o.name}
        </span>
        <span className={`num shrink-0 text-xs ${gapTone(o.premiumPct)}`}>
          {gapWords(o.premiumPct)}
        </span>
      </Link>
    </li>
  );
}
