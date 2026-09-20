import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getPreIpo, TEST_USD, type PreIpoRow } from "@/lib/pre-ipo";
import { TRADABILITY_LABEL, type Tradability } from "@/lib/radar-types";
import {
  formatAgo,
  formatCompactUsd,
  formatPct,
  formatUsd,
  gapTone,
  gapWords,
} from "@/lib/format";
import { PremiumBars } from "@/components/premium-bars";
import { PremiumSpark } from "@/components/premium-spark";
import { TickerBadge } from "@/components/ticker-badge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pre-IPO",
  description:
    "OpenAI, SpaceX, Anthropic and Neuralink as tokens on Solana: what the market pays against the mark PreStocks carries them at, what the whole company is worth at that price, and what a small buy really costs.",
  alternates: { canonical: "/pre-ipo" },
};

const PILL: Record<Tradability, string> = {
  easy: "bg-soft-up text-up",
  ok: "bg-soft text-ink",
  thin: "bg-soft-warn text-warn",
  stale: "bg-soft-warn text-warn",
  none: "bg-soft text-muted",
};

export default async function PreIpoPage() {
  const data = await getPreIpo();
  const t = data.totals;
  const widest = data.rows[0];

  return (
    <div className="flex flex-col gap-5">
      {/* What this is, and all eight against their mark */}
      <section className="card-dark overflow-hidden p-6 sm:p-8">
        <div className="grid items-center gap-8 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <p className="text-blue-light text-sm font-medium">Pre-IPO</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Companies that never opened on an exchange, priced anyway.
            </h2>
            <p className="text-on-dark-muted mt-3 leading-relaxed">
              OpenAI, SpaceX and six others trade on Solana as PreStocks tokens:
              SPV exposure to a private company, not shares. There is no closing
              bell to compare them with, so the reference is the mark their
              issuer carries them at. What the market pays above or below it is
              the premium, and it is what these pages are about.
            </p>
            {widest?.premiumPct != null && (
              <p className="mt-4 text-lg font-medium">
                Widest today: {widest.name} at{" "}
                <span
                  className={
                    widest.premiumPct < 0 ? "text-blue-light" : "text-white"
                  }
                >
                  {gapWords(widest.premiumPct)}
                </span>{" "}
                than its mark.
              </p>
            )}
            <p className="text-on-dark-muted num mt-2 text-sm">
              {t.above} above, {t.below} below, {t.companies} companies,{" "}
              {formatCompactUsd(t.liquidity)} in pools.
            </p>
          </div>
          <div className="text-white lg:col-span-6">
            <PremiumBars rows={data.rows} />
          </div>
        </div>
      </section>

      {/* One box per company */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.rows.map((r, i) => (
          <CompanyCard key={r.underlying} r={r} index={i} />
        ))}
      </section>

      {/* The honesty, spelled out once */}
      <section className="card p-5 sm:p-6">
        <h3 className="font-semibold">What you are actually holding</h3>
        <p className="text-muted mt-2 max-w-3xl text-sm leading-relaxed">
          A PreStocks token is backed one to one by SPV exposure that tracks a
          private company. It is not a share: no ownership, no voting, no
          dividend, no information rights, and no guaranteed buyer when you want
          out. The mark is the issuer&apos;s own number, not an exchange print
          and not our valuation, so treat the premium as the distance to their
          mark and nothing more. Prices here are the median of our last three
          readings, and a price older than an hour is labelled stale.
        </p>
      </section>
    </div>
  );
}

function CompanyCard({ r, index }: { r: PreIpoRow; index: number }) {
  const tone = gapTone(r.premiumPct);
  return (
    <Link
      href={`/pre-ipo/${r.underlying}`}
      style={{ "--i": index } as React.CSSProperties}
      className="card rise group flex min-w-0 flex-col overflow-hidden p-0 transition hover:border-muted-2"
    >
      {/* Who it is */}
      <div className="flex min-w-0 items-center gap-3 bg-ink p-4 text-white">
        <TickerBadge symbol={r.symbol} logo={r.logo} size={38} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{r.name}</div>
          <div className="text-on-dark-muted num truncate text-xs">
            {r.symbol} · {r.issuerName}
          </div>
        </div>
        <span className="pill shrink-0 bg-white/10 text-white">private</span>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        {/* The one number, and the two days behind it */}
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className={`num text-3xl leading-none font-semibold ${tone}`}>
              {gapWords(r.premiumPct)}
            </div>
            <div className="text-muted mt-1 text-xs">
              than the {r.issuerName} mark
            </div>
          </div>
          <PremiumSpark values={r.premiumSpark} />
        </div>

        {/* The whole company, at both numbers */}
        {r.markValuation != null && (
          <div className="grid grid-cols-2 gap-3 rounded-2xl bg-soft p-3">
            <div>
              <div className="text-muted text-xs">Market says</div>
              <div className="num font-semibold">
                {formatCompactUsd(r.marketValuation)}
              </div>
            </div>
            <div>
              <div className="text-muted text-xs">Mark says</div>
              <div className="num font-semibold">
                {formatCompactUsd(r.markValuation)}
              </div>
            </div>
          </div>
        )}

        <div className="text-muted num mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
          <span className="text-ink font-medium">{formatUsd(r.price)}</span>
          {r.change24hPct != null && (
            <span className={gapTone(-r.change24hPct)}>
              {formatPct(r.change24hPct, 1)} 24h
            </span>
          )}
          {r.impactPct != null && (
            <span>
              {formatUsd(TEST_USD, 0)} buy costs{" "}
              <span className={r.impactPct > 1 ? "text-warn" : ""}>
                {r.impactPct.toFixed(2)}%
              </span>
            </span>
          )}
          <span>{r.ageMs == null ? "–" : formatAgo(r.ageMs)}</span>
          <span className={`pill ${PILL[r.tradability]}`}>
            {TRADABILITY_LABEL[r.tradability]}
          </span>
        </div>

        <span className="text-muted-2 group-hover:text-ink inline-flex items-center gap-1 text-xs transition">
          Price, premium and a way in
          <ArrowRight size={13} strokeWidth={2} />
        </span>
      </div>
    </Link>
  );
}
