import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getPreIpo, type PreIpoRow } from "@/lib/pre-ipo";
import { formatCompactUsd, gapTone } from "@/lib/format";
import { MarkField } from "@/components/mark-field";
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

/** "10.4% above the mark", "3.6% below the mark", "at the mark". */
export function premiumWords(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return "no price yet";
  if (Math.abs(pct) < 0.25) return "at the mark";
  return `${Math.abs(pct).toFixed(1)}% ${pct > 0 ? "above" : "below"} the mark`;
}

export default async function PreIpoPage() {
  const data = await getPreIpo();
  const t = data.totals;
  const widest = data.rows[0];

  return (
    <div className="flex flex-col gap-5">
      {/* What this is, and all eight against their mark */}
      <section className="card-dark relative overflow-hidden p-6 sm:p-8">
        <MarkField />
        <div className="relative grid items-center gap-8 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <p className="text-blue-light text-sm font-medium">Pre-IPO</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Companies that never opened on an exchange, priced anyway.
            </h2>
            <p className="text-on-dark-muted mt-4 leading-relaxed">
              OpenAI, SpaceX and six others trade on Solana as PreStocks tokens.
              Each one is{" "}
              <span className="font-medium text-white">
                SPV exposure to a private company, not a share
              </span>
              , and none of them has a closing bell to be measured against. What
              they do have is a{" "}
              <span className="font-medium text-white">mark</span>: the value
              their issuer carries the company at. Buyers can pay{" "}
              <span className="text-down font-medium">more than the mark</span>{" "}
              or{" "}
              <span className="text-blue-light font-medium">less than it</span>,
              and how far they stray is the only honest number here.
            </p>
            {widest?.premiumPct != null && (
              <p className="mt-4 text-lg leading-snug font-medium">
                Today the market is furthest from the mark on {widest.name},
                paying{" "}
                <span
                  className={
                    widest.premiumPct < 0 ? "text-blue-light" : "text-down"
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
              Left of the line the market pays{" "}
              <span className="text-blue-light">less than the mark</span>, right
              of it <span className="text-down">more</span>. {t.above} above,{" "}
              {t.below} below, {t.companies} companies in total.
            </p>
          </div>
        </div>
      </section>

      {/* One box per company: a number, a sentence, a measurement */}
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
  const up = (r.premiumPct ?? 0) > 0;
  const known = r.premiumPct != null && r.markValuation != null;
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

      {/* What the market is doing, in words */}
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div
          className={`num text-3xl leading-none font-semibold ${gapTone(r.premiumPct)}`}
        >
          {premiumWords(r.premiumPct)}
        </div>
        <p className="text-muted flex-1 text-sm leading-relaxed">
          {known ? (
            <>
              Buyers are paying{" "}
              <span className={up ? "text-down" : "text-blue"}>
                {Math.abs(r.premiumPct as number).toFixed(0)}%{" "}
                {up ? "more" : "less"}
              </span>{" "}
              than {r.issuerName} marks {r.name} at, which values the company at{" "}
              <span className="text-ink font-medium">
                {formatCompactUsd(r.marketValuation)}
              </span>{" "}
              instead of{" "}
              <span className="text-ink font-medium">
                {formatCompactUsd(r.markValuation)}
              </span>
              .
            </>
          ) : (
            `We cannot read a mark for ${r.name} right now, so there is no premium to show.`
          )}
        </p>
        <span className="text-muted-2 group-hover:text-ink inline-flex items-center gap-1 text-xs transition">
          Price, cost to trade and the premium over time
          <ArrowRight size={13} strokeWidth={2} />
        </span>
      </div>

      {/* What we measured, along the bottom */}
      {r.premiumSpark.length > 2 && (
        <div className={`px-5 py-4 ${up ? "bg-soft-down" : "bg-blue-soft"}`}>
          <PremiumSpark values={r.premiumSpark} strip />
          <p className="text-muted mt-1 text-[11px]">
            the premium, last two days, against the dashed mark
          </p>
        </div>
      )}
    </Link>
  );
}
