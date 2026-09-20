import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  Droplets,
  Receipt,
  ScrollText,
  Timer,
} from "lucide-react";
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
import { companyStories } from "@/lib/hn";
import { CompanyStories } from "@/components/company-stories";
import { LogoMark } from "@/components/logo-mark";
import { MarkField } from "@/components/mark-field";
import { MintLink } from "@/components/mint-link";
import { PremiumSpark } from "@/components/premium-spark";
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
  const stories = await companyStories(c.name);
  const now = Date.parse(c.generatedAt);
  const up = (c.premiumPct ?? 0) > 0;
  const range = c.premiumRange;
  // Where today sits in the window we have watched, in plain words.
  const standing =
    range && range.high - range.low > 0.2
      ? (c.premiumPct ?? 0) >= range.high - (range.high - range.low) * 0.2
        ? "the high end of what we have seen these two days"
        : (c.premiumPct ?? 0) <= range.low + (range.high - range.low) * 0.2
          ? "the low end of what we have seen these two days"
          : "the middle of what we have seen these two days"
      : null;

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/pre-ipo"
        className="text-muted hover:text-ink inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft size={15} strokeWidth={1.75} />
        Pre-IPO
      </Link>

      {/* The company on the left, the way in on the right */}
      <div className="grid gap-5 lg:grid-cols-12">
        <section className="card-dark relative overflow-hidden p-6 sm:p-8 lg:col-span-7">
          <MarkField />
          <div className="relative">
            <div className="flex items-center gap-3">
              <TickerBadge symbol={c.symbol} logo={c.logo} size={48} />
              <div className="min-w-0">
                <h2 className="truncate text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
                  {c.name}
                </h2>
                <p className="text-on-dark-muted num text-sm">
                  {c.symbol} · {c.issuerName} · private company
                </p>
                <MintLink
                  mint={c.mint}
                  address
                  pill
                  dark
                  className="mt-2"
                />
              </div>
            </div>

            <p
              className={`mt-6 text-4xl font-semibold tracking-tight sm:text-5xl ${up ? "text-down" : "text-blue-light"}`}
            >
              {gapWords(c.premiumPct)}
            </p>
            <p className="text-on-dark-muted mt-1">
              than {MARK}. The token trades at{" "}
              <span className="text-white">{formatUsd(c.price)}</span> against a
              mark of <span className="text-white">{formatUsd(c.mark)}</span>.{" "}
              {c.ageMs == null ? "" : `Last trade ${formatAgo(c.ageMs)}.`}
            </p>

            {/* The company itself, at both numbers */}
            {c.markValuation != null && (
              <div className="mt-6 grid max-w-md grid-cols-2 gap-3">
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

            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
              <span className={`pill ${PILL[c.tradability]}`}>
                {TRADABILITY_LABEL[c.tradability]}
              </span>
              <span className="pill bg-white/10 text-white">
                trades around the clock
              </span>
            </div>

            {c.premiumSpark.length > 2 && (
              <div className="mt-6 text-white/70">
                <PremiumSpark values={c.premiumSpark} strip />
                <p className="text-on-dark-muted mt-1 text-xs">
                  the premium over the last two days, against the dashed mark
                </p>
              </div>
            )}
          </div>
        </section>

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

      {/* The four things worth knowing before you press buy */}
      <section
        className="card rise grid divide-line sm:grid-cols-2 sm:divide-x xl:grid-cols-4"
        style={{ "--i": 1 } as React.CSSProperties}
      >
        <Fact
          icon={<Receipt size={16} strokeWidth={1.75} />}
          label="Cost to get in"
          value={
            c.impactPct == null ? "–" : `${c.impactPct.toFixed(2)}% impact`
          }
          detail={`on a ${formatUsd(TEST_USD, 0)} buy, from a live route`}
          tone={c.impactPct != null && c.impactPct > 1 ? "text-warn" : ""}
        />
        <Fact
          icon={<Droplets size={16} strokeWidth={1.75} />}
          label="Depth"
          value={formatCompactUsd(c.liquidity)}
          detail="sitting in onchain pools right now"
        />
        <Fact
          icon={<Timer size={16} strokeWidth={1.75} />}
          label="Last trade"
          value={c.ageMs == null ? "–" : formatAgo(c.ageMs)}
          detail={
            c.change24hPct == null
              ? "onchain, around the clock"
              : `${formatPct(c.change24hPct, 1)} over 24 hours`
          }
        />
        <Fact
          icon={<Building2 size={16} strokeWidth={1.75} />}
          label="Premium, two days"
          value={
            range
              ? `${range.low > 0 ? "+" : ""}${range.low.toFixed(1)}% to ${range.high > 0 ? "+" : ""}${range.high.toFixed(1)}%`
              : "filling in"
          }
          detail={
            standing
              ? `today sits at ${standing}`
              : "we started watching this one recently"
          }
        />
      </section>

      {/* What the company does, and what the token actually is */}
      <section
        className="rise grid gap-4 lg:grid-cols-12"
        style={{ "--i": 2 } as React.CSSProperties}
      >
        {c.about && (
          <div className="card relative overflow-hidden p-5 sm:p-6 lg:col-span-7">
            <LogoMark
              logo={c.logo}
              size={180}
              opacity={0.05}
              className="-right-8 -bottom-8"
            />
            <p className="label-micro text-blue relative">The company</p>
            <h3 className="relative mt-1 text-xl font-semibold tracking-tight">
              What {c.name} does
            </h3>
            <p className="text-muted mt-3 leading-relaxed">{c.about}</p>
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
          <p className="label-micro text-muted-2">The instrument</p>
          <h3 className="mt-1 flex items-center gap-2 text-xl font-semibold tracking-tight">
            <span className="icon-badge h-7 w-7">
              <ScrollText size={14} strokeWidth={1.75} />
            </span>
            What you are holding
          </h3>
          <p className="text-muted mt-3 text-sm leading-relaxed">
            {c.tokenNote ?? c.structure}
          </p>
          <ul className="text-muted mt-3 space-y-1 text-sm">
            <li>
              No ownership, no voting, no dividend, no information rights.
            </li>
            <li>No guaranteed buyer when you want out.</li>
            <li>
              The mark is {c.issuerName}&apos;s own number, not an exchange
              price and not a valuation of ours.
            </li>
          </ul>
        </div>
      </section>

      <CompanyStories name={c.name} stories={stories} now={now} />

      {/* What we measured ourselves, on black, as one block */}
      <section
        className="card-dark rise p-5 sm:p-6"
        style={{ "--i": 4 } as React.CSSProperties}
      >
        <p className="label-micro text-blue-light">Measured by us</p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-xl font-semibold tracking-tight">
            The premium, last two days
          </h3>
          <span className="text-on-dark-muted text-xs">
            our own snapshots, one a minute
          </span>
        </div>
        <p className="text-on-dark-muted mt-1 max-w-2xl text-sm">
          How far the onchain price sat from {MARK}.{" "}
          <span className="text-blue-light">Blue</span> means the market paid
          less than the issuer&apos;s mark,{" "}
          <span className="text-down">red</span> means more.
        </p>
        <div className="mt-4">
          <GapChart
            dark
            series={c.premiumHistory.map((p) => ({
              ts: p.ts,
              gapPct: p.premiumPct,
            }))}
            referencePhrase={MARK}
          />
        </div>
      </section>

      <div className="rise" style={{ "--i": 5 } as React.CSSProperties}>
        <PriceChart
          candles={c.candles}
          reference={c.mark}
          referenceLabel="Mark"
          now={now}
          symbol={c.symbol}
          sessions={false}
        />
      </div>

      {/* Where to go next */}
      {c.others.length > 0 && (
        <section
          className="card rise p-5 sm:p-6"
          style={{ "--i": 6 } as React.CSSProperties}
        >
          <p className="label-micro text-muted-2">Keep looking</p>
          <h3 className="mt-1 text-xl font-semibold tracking-tight">
            The other companies
          </h3>
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

function Fact({
  icon,
  label,
  value,
  detail,
  tone = "",
  pill,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  tone?: string;
  pill?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 p-5">
      <div className="text-muted-2 label-micro flex items-center gap-2">
        <span className="icon-badge h-6 w-6">{icon}</span>
        {label}
      </div>
      <div className={`num text-xl leading-tight font-semibold ${tone}`}>
        {value}
      </div>
      {pill ? (
        <span className={`pill mt-1 w-fit ${pill}`}>{detail}</span>
      ) : (
        <div className="text-muted text-xs leading-relaxed">{detail}</div>
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
