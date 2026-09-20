import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";
import { getPreIpo, type PreIpoRow } from "@/lib/pre-ipo";
import { formatCompactUsd, gapTone } from "@/lib/format";
import { LogoMark } from "@/components/logo-mark";
import { MarkField } from "@/components/mark-field";
import { PremiumBars } from "@/components/premium-bars";
import { PremiumSpark } from "@/components/premium-spark";
import { PoweredBy } from "@/components/powered-by";
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

/**
 * The opening of the issuer's blurb, cut at a sentence end. A clamp alone
 * put an ellipsis mid-sentence on every one of the eight cards, which reads
 * as a bug rather than as a summary.
 */
function lead(about: string, max = 165): string {
  const sentences = about.match(/[^.!?]+[.!?]+\s*/g);
  if (!sentences) return about;
  let out = "";
  for (const s of sentences) {
    if (out && (out + s).trim().length > max) break;
    out += s;
  }
  return (out || sentences[0]).trim();
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
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-blue-light text-sm font-medium">Pre-IPO</p>
              <PoweredBy />
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Companies that never opened on an exchange, priced anyway.
            </h2>
            <p className="text-on-dark-muted mt-4 leading-relaxed">
              OpenAI, SpaceX and six others trade on Solana as{" "}
              <span className="font-medium text-white">
                SPV exposure, not shares
              </span>
              . With no closing bell, the only honest reference is the{" "}
              <span className="font-medium text-white">mark</span> their issuer
              carries them at. Buyers pay{" "}
              <span className="text-down font-medium">more than the mark</span>{" "}
              or{" "}
              <span className="text-blue-light font-medium">less than it</span>,
              and that distance is the number on this page.
            </p>
            {widest?.premiumPct != null && (
              <p className="mt-4 leading-snug font-medium">
                Furthest from the mark today: {widest.name}, at{" "}
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
            <div className="mt-6 flex flex-wrap gap-2.5">
              <a href="#companies" className="btn btn-white">
                Start trading
                <ArrowDown size={16} strokeWidth={2} />
              </a>
              <Link
                href="/how#pre-ipo"
                className="btn border border-white/25 bg-white/5 text-white hover:bg-white/10"
              >
                Learn more
                <ArrowRight size={16} strokeWidth={2} />
              </Link>
            </div>
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
      <section
        id="companies"
        className="grid scroll-mt-24 gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        {data.rows.map((r, i) => (
          <CompanyCard key={r.underlying} r={r} index={i} />
        ))}
      </section>

      {/* The honesty, spelled out once */}
      <section className="card p-5 sm:p-6">
        <p className="label-micro text-muted-2">The instrument</p>
        <h3 className="mt-1 text-xl font-semibold tracking-tight">
          What you are actually holding
        </h3>
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
  // A wash of either colour overstates a company sitting on its mark.
  const flat = r.premiumPct == null || Math.abs(r.premiumPct) < 0.25;
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
      <div className="relative flex flex-1 flex-col gap-2.5 overflow-hidden p-5">
        <LogoMark
          logo={r.logo}
          size={150}
          opacity={0.05}
          className="-right-6 -bottom-6"
        />
        {r.about && (
          <p className="relative line-clamp-4 text-sm leading-relaxed">
            {lead(r.about)}
          </p>
        )}

        <div className="border-line relative mt-auto border-t pt-3">
          <p className="label-micro text-muted-2">Against the mark</p>
          <div
            className={`num mt-1 text-xl leading-none font-semibold ${gapTone(r.premiumPct)}`}
          >
            {premiumWords(r.premiumPct)}
          </div>
        </div>
        <p className="text-muted relative text-sm leading-relaxed">
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
        <span className="btn btn-sm relative mt-1 w-full group-hover:bg-black">
          Trade {r.symbol}
          <ArrowRight size={14} strokeWidth={2} />
        </span>
        <span className="text-muted-2 relative text-[11px]">
          price, cost to trade and the premium over time
        </span>
      </div>

      {/* What we measured, along the bottom */}
      {r.premiumSpark.length > 2 && (
        <div className={`px-5 py-4 ${flat ? "bg-soft" : up ? "bg-soft-down" : "bg-blue-soft"}`}>
          <PremiumSpark values={r.premiumSpark} strip />
          <p className="text-muted mt-1 text-[11px]">
            the premium, last two days, against the dashed mark
          </p>
        </div>
      )}
    </Link>
  );
}
