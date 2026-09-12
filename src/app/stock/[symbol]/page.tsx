import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, CalendarDays, Clock, Layers, Scale } from "lucide-react";
import { getStock } from "@/lib/stock";
import { formatAgo, formatCompactUsd, formatPct, formatUsd } from "@/lib/format";
import { TRADABILITY_LABEL, type Tradability } from "@/lib/radar-types";
import { PriceChart } from "@/components/price-chart";
import { BuyPanel } from "@/components/buy-panel";
import { StatCard } from "@/components/stat-card";
import { TickerBadge } from "@/components/ticker-badge";
import { Tip } from "@/components/tip";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ symbol: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { symbol } = await params;
  const stock = getStock(symbol);
  return { title: stock ? `${stock.name} (${stock.underlying})` : "Not found" };
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
  thin: "Very little liquidity. Expect a bad price on anything but tiny orders.",
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
      <div className="flex items-center gap-3">
        <Link href="/stocks" className="icon-badge h-8 w-8" aria-label="All stocks">
          <ArrowLeft size={15} strokeWidth={1.75} />
        </Link>
        <TickerBadge symbol={p.symbol} size={40} />
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{stock.name}</h2>
          <p className="text-muted text-sm">
            {stock.underlying} · {stock.tokens.length} {stock.tokens.length === 1 ? "issuer" : "issuers"} on Solana
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Scale}
          label="Onchain price"
          value={formatUsd(p.price)}
          badge={<span className={`pill ${(p.gapPct ?? 0) >= 0 ? "pill-dark" : "bg-soft-down text-down"}`}>{formatPct(p.gapPct)}</span>}
        />
        <StatCard
          icon={Layers}
          label={stock.reference.short}
          value={formatUsd(p.reference)}
          detail={
            <Tip text={stock.liveReference ? "The live price on the exchange or the overnight venue." : "The last regular-session price on Wall Street. While the exchange is shut this is the only anchor."}>
              what is this
            </Tip>
          }
        />
        <StatCard
          icon={Clock}
          label="Updated"
          value={p.ageMs == null ? "–" : formatAgo(p.ageMs)}
          detail={<span className={`pill ${PILL[p.tradability]}`}>{TRADABILITY_LABEL[p.tradability]}</span>}
        />
        <StatCard
          icon={CalendarDays}
          label="Next earnings"
          value={stock.nextEarnings ? earningsDate.format(new Date(`${stock.nextEarnings.date}T12:00:00Z`)) : "–"}
          detail={stock.nextEarnings ? stock.nextEarnings.timing : "none scheduled"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="flex flex-col gap-5 lg:col-span-8">
          <PriceChart candles={stock.candles} reference={p.reference} referenceLabel={stock.reference.short} now={now} symbol={p.symbol} />

          <section className="card p-5">
            <h2 className="font-semibold">Where it trades</h2>
            <p className="text-muted mt-1 text-sm">
              Same company, different wrappers. Each issuer has its own legal structure, so the tokens are not
              interchangeable. We quote the one with the deepest pool.
            </p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {stock.tokens.map((t) => (
                <li key={t.mint} className="rounded-2xl bg-soft p-4">
                  <div className="flex items-center gap-2.5">
                    <TickerBadge symbol={t.symbol} size={30} />
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
                        <span className={`num text-xs ${tone(t.gapPct)}`}>{formatPct(t.gapPct)}</span>
                      </span>
                    )}
                    <span className="text-right">
                      <span className={`pill ${PILL[t.tradability]}`}>
                        <Tip text={TRADABILITY_TIP[t.tradability]}>{TRADABILITY_LABEL[t.tradability]}</Tip>
                      </span>
                      {t.tradability !== "none" && (
                        <span className="text-muted mt-1 block text-xs">{formatCompactUsd(t.liquidity)} in pools</span>
                      )}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="lg:col-span-4">
          <BuyPanel
            mint={p.mint}
            symbol={p.symbol}
            referencePhrase={stock.reference.phrase}
            phase={stock.phase.phase}
            ageMs={p.ageMs}
            liquidity={p.liquidity}
            disabled={p.tradability === "none"}
          />
        </div>
      </div>
    </div>
  );
}

function tone(gap: number | null): string {
  if (gap == null || Math.abs(gap) < 0.25) return "text-muted";
  return gap > 0 ? "text-up" : "text-down";
}
