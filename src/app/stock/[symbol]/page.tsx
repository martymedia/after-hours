import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, CalendarDays, Clock, Layers, Scale } from "lucide-react";
import { getStock } from "@/lib/stock";
import { formatAgo, formatCompactUsd, formatUsd, gapSentence, gapTone, gapWords } from "@/lib/format";
import { TRADABILITY_LABEL, type Tradability } from "@/lib/radar-types";
import { PriceChart } from "@/components/price-chart";
import { TradeCard } from "@/components/trade-card";
import { StatCard } from "@/components/stat-card";
import { TickerBadge } from "@/components/ticker-badge";
import { GapChart } from "@/components/gap-chart";
import { Tip } from "@/components/tip";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ symbol: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { symbol } = await params;
  const stock = getStock(symbol);
  if (!stock) return { title: "Not found", robots: { index: false } };
  const p = stock.primary;
  const priceLine = p.price != null ? `${formatUsd(p.price)} onchain, ${gapSentence(p.gapPct, stock.reference.phrase)}.` : "";
  const description = `${stock.name} (${stock.underlying}) as a tokenized stock on Solana. ${priceLine} ${stock.description} Buy from your own wallet, 24/7.`.replace(/\s+/g, " ").trim();
  const title = `${stock.name} (${stock.underlying}) after hours`;
  return {
    title,
    description,
    alternates: { canonical: `/stock/${stock.underlying}` },
    openGraph: { title: `${title} | After Hours`, description, url: `/stock/${stock.underlying}`, type: "website" },
    twitter: { card: "summary_large_image", title: `${title} | After Hours`, description },
  };
}

const PILL: Record<Tradability, string> = {
  easy: "bg-soft-up text-up",
  ok: "bg-soft text-ink",
  thin: "bg-soft-warn text-warn",
  stale: "bg-soft-warn text-warn",
  none: "bg-soft text-muted",
};

const TRADABILITY_TIP: Record<string, string> = {
  easy: "More than 500k USD sits in this token's pools. Orders up to a few thousand dollars barely move the price.",
  ok: "Between 50k and 500k USD in pools. Fine for small amounts; large orders would move the price.",
  thin: "Liquidity dropped under 50k USD since we listed it. Expect a bad price on anything but tiny orders.",
  stale: "The last trade was more than an hour ago. The price you see may not be where it would trade now.",
  none: "No pool with real liquidity on Solana. This token is minted and redeemed with the issuer directly.",
};

const earningsDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export default async function StockPage({ params }: Props) {
  const { symbol } = await params;
  const stock = getStock(symbol);
  if (!stock) notFound();

  const now = Date.parse(stock.generatedAt);
  const p = stock.primary;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <Link href="/stocks" className="icon-badge mt-1 h-8 w-8 shrink-0" aria-label="All stocks">
          <ArrowLeft size={15} strokeWidth={1.75} />
        </Link>
        <TickerBadge symbol={p.symbol} logo={p.logo} size={44} />
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight">{stock.name}</h2>
          <p className="text-muted text-sm">
            {stock.underlying} · {stock.sector} · {stock.tokens.length} {stock.tokens.length === 1 ? "issuer" : "issuers"} on Solana
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed">{stock.description}</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="lg:order-2 lg:col-span-4">
          <TradeCard
            mint={p.mint}
            symbol={p.symbol}
            name={stock.name}
            logo={p.logo}
            referencePhrase={stock.reference.phrase}
            phase={stock.phase.phase}
            ageMs={p.ageMs}
            liquidity={p.liquidity}
            reference={p.reference}
            price={p.price}
            disabled={p.tradability === "none"}
          />
        </div>
        <div className="flex flex-col gap-5 lg:order-1 lg:col-span-8">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          icon={Scale}
          label="Onchain price"
          value={formatUsd(p.price)}
          detail={
            <>
              <span className={`num font-medium ${gapTone(p.gapPct)}`}>{gapSentence(p.gapPct, stock.reference.phrase)}</span>
            </>
          }
          hint="The last trade of the most liquid token for this stock on Solana."
        />
        <StatCard
          icon={Layers}
          label={stock.reference.short}
          value={formatUsd(p.reference)}
          detail={stock.liveReference ? "live exchange price" : "last regular session"}
          hint={
            stock.liveReference
              ? "The live price on the exchange or the overnight venue, so the onchain price has something real to compare against."
              : "The last regular-session price on Wall Street. While the exchange is shut this is the only anchor; onchain can drift from it."
          }
        />
        <StatCard
          icon={Clock}
          label="Updated"
          value={p.ageMs == null ? "–" : formatAgo(p.ageMs)}
          detail={
            <span className="flex flex-wrap items-center gap-2">
              <span className={`pill ${PILL[p.tradability]}`}>{TRADABILITY_LABEL[p.tradability]}</span>
              <span>{formatCompactUsd(p.liquidity)} in pools</span>
            </span>
          }
          hint="Time since the most recent onchain trade. Old means the price may be out of date."
        />
        <StatCard
          icon={CalendarDays}
          label="Next earnings"
          value={stock.nextEarnings ? earningsDate.format(new Date(`${stock.nextEarnings.date}T12:00:00Z`)) : "–"}
          detail={stock.nextEarnings ? stock.nextEarnings.timing : "none in the next 60 days"}
          hint="Earnings reports usually land after the closing bell. Onchain prices react hours before a brokerage would let you."
        />
          </div>
          <PriceChart candles={stock.candles} reference={p.reference} referenceLabel={stock.reference.short} now={now} symbol={p.symbol} />

          <section className="card p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">Gap radar</h2>
              <span className="text-muted text-xs">last 48 hours</span>
            </div>
            <p className="text-muted mt-1 mb-3 text-sm">
              How far the onchain price sits from {stock.reference.phrase}, every 15 minutes. Blue bars below the
              line: cheaper onchain. Red bars above: pricier.
            </p>
            <GapChart series={stock.gapSeries} referencePhrase={stock.reference.phrase} />
          </section>

          <section className="card p-5">
            <h2 className="font-semibold">What you are buying</h2>
            <p className="text-muted mt-1 text-sm">
              Same company, different wrappers. Each issuer has its own legal structure, so the tokens are not
              interchangeable. We quote the one with the deepest pool.
            </p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {stock.tokens.map((t) => (
                <li key={t.mint} className="rounded-2xl bg-soft p-4">
                  <div className="flex items-center gap-2.5">
                    <TickerBadge symbol={t.symbol} logo={t.logo} size={30} />
                    <div>
                      <div className="text-sm font-medium">{t.issuerName}</div>
                      <div className="text-muted text-xs">
                        {t.symbol} · <Tip text={t.structure}>{t.structureShort}</Tip>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-end justify-between">
                    {t.tradability === "none" ? (
                      <span className="text-muted text-sm">No onchain price worth showing.</span>
                    ) : (
                      <span>
                        <span className="num block text-lg font-semibold">{formatUsd(t.price)}</span>
                        <span className={`num text-xs ${gapTone(t.gapPct)}`}>{gapWords(t.gapPct)}</span>
                      </span>
                    )}
                    <span className="text-right">
                      <Tip text={TRADABILITY_TIP[t.tradability]} underline={false}>
                        <span className={`pill ${PILL[t.tradability]}`}>{TRADABILITY_LABEL[t.tradability]}</span>
                      </Tip>
                      {t.tradability !== "none" && (
                        <span className="text-muted mt-1 block text-xs">{formatCompactUsd(t.liquidity)} in pools</span>
                      )}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {stock.similar.length > 0 && (
            <section className="card p-5">
              <div className="flex items-baseline justify-between">
                <h2 className="font-semibold">More in {stock.sector}</h2>
                <Link href="/stocks" className="text-muted text-sm hover:text-ink">
                  All stocks
                </Link>
              </div>
              <ul className="mt-3 divide-y divide-line">
                {stock.similar.map((r) => (
                  <li key={r.underlying}>
                    <Link href={`/stock/${r.underlying}`} className="flex items-center gap-3 py-2.5 hover:opacity-80">
                      <TickerBadge symbol={r.symbol} logo={r.logo} size={30} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{r.name}</span>
                        <span className="text-muted block text-xs">
                          {r.symbol} · {r.issuerName}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="num block text-sm font-semibold">{formatUsd(r.price)}</span>
                        <span className={`num block text-xs ${gapTone(r.gapPct)}`}>{gapWords(r.gapPct)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

