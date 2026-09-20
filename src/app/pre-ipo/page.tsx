import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getPreIpo, TEST_USD, type PreIpoRow } from "@/lib/pre-ipo";
import { TRADABILITY_LABEL, type Tradability } from "@/lib/radar-types";
import { formatAgo, formatUsd, gapTone, gapWords } from "@/lib/format";
import { PremiumScale } from "@/components/premium-scale";
import { Sparkline } from "@/components/sparkline";
import { TickerBadge } from "@/components/ticker-badge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pre-IPO",
  description:
    "OpenAI, SpaceX, Anthropic and Neuralink as tokens on Solana: what the market pays against the mark PreStocks carries them at, how fresh that price is, and how deep the pool behind it is.",
  alternates: { canonical: "/pre-ipo" },
};

const PILL: Record<Tradability, string> = {
  easy: "bg-soft-up text-up",
  ok: "bg-soft text-ink",
  thin: "bg-soft-warn text-warn",
  stale: "bg-soft-warn text-warn",
  none: "bg-soft text-muted",
};

function compactUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return formatUsd(n, 0);
}

export default async function PreIpoPage() {
  const data = await getPreIpo();
  const t = data.totals;
  const widest = data.rows[0];

  return (
    <div className="flex flex-col gap-5">
      {/* What this is, and every company at a glance */}
      <section className="card-dark overflow-hidden p-6 sm:p-8">
        <div className="grid items-center gap-8 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="text-blue-light text-sm font-medium">Pre-IPO</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Companies that never opened on an exchange, priced anyway.
            </h2>
            <p className="text-on-dark-muted mt-3 leading-relaxed">
              OpenAI, SpaceX and six others trade on Solana as PreStocks tokens:
              SPV exposure to a private company, not shares. There is no closing
              bell to compare them with, so the only honest reference is the
              mark their issuer carries them at. What the market pays above or
              below it is the premium, and it is the number these pages are
              about.
            </p>
            <div className="text-on-dark-muted mt-4 text-sm">
              {t.above} above the mark, {t.below} below, out of {t.companies}{" "}
              companies with {compactUsd(t.liquidity)} in pools.
            </div>
          </div>
          <div className="text-on-dark-muted lg:col-span-7">
            <PremiumScale rows={data.rows} />
          </div>
        </div>
      </section>

      {/* One box per company: the premium, the shape of the week, one way in */}
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
        {widest?.premiumPct != null && (
          <p className="text-muted mt-3 text-sm">
            Right now the widest is {widest.name} at{" "}
            <span className={gapTone(widest.premiumPct)}>
              {gapWords(widest.premiumPct)}
            </span>{" "}
            than the mark.
          </p>
        )}
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
      className="card rise group flex min-w-0 flex-col p-5 transition hover:border-muted-2"
    >
      <div className="flex min-w-0 items-center gap-3">
        <TickerBadge symbol={r.symbol} logo={r.logo} size={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold group-hover:underline">
            {r.name}
          </div>
          <div className="text-muted num truncate text-xs">
            {r.symbol} · {r.issuerName}
          </div>
        </div>
      </div>

      {/* The one number, and the week behind it */}
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <div className={`num text-3xl leading-none font-semibold ${tone}`}>
            {gapWords(r.premiumPct)}
          </div>
          <div className="text-muted mt-1 text-xs">than the mark</div>
        </div>
        {r.spark.length > 1 && (
          <Sparkline
            values={r.spark}
            width={96}
            height={34}
            color={
              r.premiumPct != null && r.premiumPct < 0
                ? "var(--color-blue)"
                : "var(--color-down)"
            }
            fill
          />
        )}
      </div>

      <div className="text-muted num mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-3 text-xs">
        <span className="text-ink font-medium">{formatUsd(r.price)}</span>
        <span>mark {formatUsd(r.mark)}</span>
        <span>{r.ageMs == null ? "–" : formatAgo(r.ageMs)}</span>
        <span className={`pill ${PILL[r.tradability]}`}>
          {TRADABILITY_LABEL[r.tradability]}
        </span>
      </div>
      {r.impactPct != null && (
        <div className="text-muted num mt-2 text-xs">
          a {formatUsd(TEST_USD, 0)} buy costs{" "}
          <span className={r.impactPct > 1 ? "text-warn" : "text-ink"}>
            {r.impactPct.toFixed(2)}%
          </span>{" "}
          in price impact
        </div>
      )}
      <span className="text-muted-2 group-hover:text-ink mt-3 inline-flex items-center gap-1 text-xs transition">
        Price, premium and a way in
        <ArrowRight size={13} strokeWidth={2} />
      </span>
    </Link>
  );
}
