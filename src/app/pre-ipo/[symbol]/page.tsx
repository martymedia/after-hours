import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { getPreIpoCompany } from "@/lib/pre-ipo";
import { formatAgo, formatCompactUsd, formatUsd, gapWords } from "@/lib/format";
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
      ? `${formatUsd(c.price)} onchain, ${gapWords(c.premiumPct)} than the mark PreStocks carries it at.`
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
  // The company blurb ends with the issuer's own sentence about the token;
  // we print that separately, so keep only what is about the business.
  const about = (c.about ?? "").split(/\n\n|\.\s+[A-Z]+ is a PreStocks/)[0];

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/pre-ipo"
        className="text-muted hover:text-ink inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft size={15} strokeWidth={1.75} />
        Pre-IPO
      </Link>

      {/* One number that matters, and what it is measured against */}
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
              <span
                className={
                  c.premiumPct != null && c.premiumPct < 0
                    ? "text-blue-light"
                    : "text-white/70"
                }
              >
                {gapWords(c.premiumPct)}
              </span>
            </p>
            <p className="text-on-dark-muted mt-1">
              than {MARK} of {formatUsd(c.mark)} per token.{" "}
              {c.ageMs == null ? "" : `Last trade ${formatAgo(c.ageMs)}.`}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span className={`pill ${PILL[c.tradability]}`}>
                {TRADABILITY_LABEL[c.tradability]}
              </span>
              <span className="pill bg-white/10 text-white">
                {formatCompactUsd(c.liquidity)} in pools
              </span>
              <a
                href={c.issuerPage ?? c.issuerUrl}
                target="_blank"
                rel="noreferrer"
                className="pill inline-flex items-center gap-1 bg-white/10 text-white hover:bg-white/20"
              >
                {c.issuerName}
                <ArrowUpRight size={12} strokeWidth={2} />
              </a>
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

      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold">Price, last seven days</h3>
          <span className="text-muted text-xs">
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

      <section className="card p-5 sm:p-6">
        <h3 className="font-semibold">The premium, last two days</h3>
        <p className="text-muted mt-1 max-w-2xl text-sm">
          How far the onchain price sat from {MARK}, from our own snapshots.
          Blue means the market paid less than the issuer&apos;s mark, red means
          more.
        </p>
        <div className="mt-3">
          <GapChart
            series={c.premiumSeries.map((p) => ({
              ts: p.ts,
              gapPct: p.premiumPct,
            }))}
            referencePhrase={MARK}
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5 sm:p-6">
          <h3 className="font-semibold">What you are holding</h3>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            {c.structure}
          </p>
          <p className="text-muted mt-3 text-sm leading-relaxed">
            The mark is {c.issuerName}&apos;s own number for the SPV, not an
            exchange price and not a valuation of ours. A premium means the
            market disagrees with it today, in one direction or the other.
          </p>
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
        {about && (
          <div className="card p-5 sm:p-6">
            <h3 className="font-semibold">About the company</h3>
            <p className="text-muted mt-2 text-sm leading-relaxed">{about}</p>
          </div>
        )}
      </section>
    </div>
  );
}
