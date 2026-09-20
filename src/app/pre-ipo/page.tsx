import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getPreIpo, type PreIpoRow } from "@/lib/pre-ipo";
import { formatCompactUsd, gapTone } from "@/lib/format";
import { PremiumBars } from "@/components/premium-bars";
import { PremiumSpark } from "@/components/premium-spark";
import { TickerBadge } from "@/components/ticker-badge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pre-IPO",
  description:
    "OpenAI, SpaceX, Anthropic and Neuralink as tokens on Solana: what buyers pay against the mark PreStocks carries them at, and what that says the whole company is worth.",
  alternates: { canonical: "/pre-ipo" },
};

/** "27.0% above the mark", "3.6% below the mark", "at the mark". */
function premiumWords(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return "no price yet";
  if (Math.abs(pct) < 0.25) return "at the mark";
  return `${Math.abs(pct).toFixed(1)}% ${pct > 0 ? "above" : "below"} the mark`;
}

/** The card's whole explanation, in one sentence a person can read out loud. */
function premiumSentence(r: PreIpoRow): string {
  const market = formatCompactUsd(r.marketValuation);
  const mark = formatCompactUsd(r.markValuation);
  if (r.premiumPct == null || r.markValuation == null)
    return `${r.issuerName} has not published a mark for ${r.name} that we can read right now.`;
  if (Math.abs(r.premiumPct) < 0.25)
    return `Buyers are paying about what ${r.issuerName} marks ${r.name} at, roughly ${mark} for the company either way.`;
  const more = r.premiumPct > 0 ? "more" : "less";
  return `Buyers are paying ${Math.abs(r.premiumPct).toFixed(0)}% ${more} than ${r.issuerName} marks ${r.name} at, which values the company at ${market} instead of ${mark}.`;
}

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
            <p className="text-on-dark-muted mt-4 leading-relaxed">
              OpenAI, SpaceX and six others trade on Solana as PreStocks tokens.
              Each one is SPV exposure to a private company, not a share, and
              none of them has a closing bell to be measured against. What they
              do have is a mark: the value their issuer carries the company at.
              Buyers can pay more than that mark or less, and how far they stray
              is the only honest number here.
            </p>
            {widest?.premiumPct != null && (
              <p className="mt-4 text-lg leading-snug font-medium">
                Today the market is furthest from the mark on {widest.name},
                paying{" "}
                <span
                  className={
                    widest.premiumPct < 0 ? "text-blue-light" : "text-white"
                  }
                >
                  {premiumWords(widest.premiumPct)}
                </span>
                .
              </p>
            )}
          </div>
          <div className="text-white lg:col-span-6">
            <PremiumBars rows={data.rows} />
            <p className="text-on-dark-muted mt-4 text-xs">
              Left of the line the market pays less than the mark, right of it
              more. {t.above} above, {t.below} below, {t.companies} companies in
              total.
            </p>
          </div>
        </div>
      </section>

      {/* One box per company: a number, a picture, a sentence */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.rows.map((r, i) => (
          <CompanyCard key={r.underlying} r={r} index={i} />
        ))}
      </section>

      {/* The honesty, spelled out once */}
      <section className="card p-5 sm:p-6">
        <h3 className="font-semibold">What you are actually holding</h3>
        <p className="text-muted mt-2 max-w-3xl leading-relaxed">
          A PreStocks token is backed one to one by SPV exposure that tracks a
          private company. It is not a share: no ownership, no voting, no
          dividend, no information rights, and no guaranteed buyer when you want
          out. The mark is the issuer&apos;s own number, not an exchange print
          and not our valuation, so read the premium as the distance to their
          mark and nothing more. Open a company to see the price, what a trade
          would cost, how deep the pool is and how the premium moved.
        </p>
      </section>
    </div>
  );
}

function CompanyCard({ r, index }: { r: PreIpoRow; index: number }) {
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

      <div className="flex flex-1 flex-col gap-3 p-5">
        {/* The one number, and the two days behind it */}
        <div className="flex items-end justify-between gap-3">
          <div
            className={`num text-2xl leading-none font-semibold ${gapTone(r.premiumPct)}`}
          >
            {premiumWords(r.premiumPct)}
          </div>
          <PremiumSpark values={r.premiumSpark} />
        </div>

        {/* What that actually means */}
        <p className="text-muted flex-1 text-sm leading-relaxed">
          {premiumSentence(r)}
        </p>

        <span className="text-muted-2 group-hover:text-ink inline-flex items-center gap-1 text-xs transition">
          Price, cost to trade and the premium over time
          <ArrowRight size={13} strokeWidth={2} />
        </span>
      </div>
    </Link>
  );
}
