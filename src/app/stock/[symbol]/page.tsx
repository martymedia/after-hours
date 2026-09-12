import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getStock } from "@/lib/stock";
import { formatAgo, formatCompactUsd, formatPct, formatUsd } from "@/lib/format";
import { TRADABILITY_LABEL } from "@/lib/radar-types";
import { PriceChart } from "@/components/price-chart";
import { BuyPanel } from "@/components/buy-panel";
import { Tip } from "@/components/tip";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ symbol: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { symbol } = await params;
  const stock = getStock(symbol);
  return { title: stock ? `${stock.name} (${stock.underlying})` : "Not found" };
}

const TRADABILITY_TIP: Record<string, string> = {
  easy: "More than 500k USD sits in this token's pools. Orders up to a few thousand dollars barely move the price.",
  ok: "Between 50k and 500k USD in pools. Fine for small amounts; large orders would move the price.",
  thin: "Very little liquidity. Expect a bad price on anything but tiny orders.",
  stale: "The last trade was more than an hour ago. The price you see may not be where it would trade now.",
  none: "No pool with real liquidity on Solana. This token is minted and redeemed with the issuer directly.",
};

export default async function StockPage({ params }: Props) {
  const { symbol } = await params;
  const stock = getStock(symbol);
  if (!stock) notFound();

  const now = Date.parse(stock.generatedAt);
  const p = stock.primary;

  return (
    <>
      <Link href="/stocks" className="text-muted text-sm hover:underline">
        ← All stocks
      </Link>

      <header className="mt-4 mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{stock.name}</h1>
          <p className="text-muted mt-1 text-sm">
            {stock.underlying} · {stock.tokens.length} {stock.tokens.length === 1 ? "issuer" : "issuers"} on Solana
            {stock.nextEarnings
              ? ` · earnings ${formatEarningsDate(stock.nextEarnings.date)}${
                  stock.nextEarnings.timing !== "unknown" ? `, ${stock.nextEarnings.timing}` : ""
                }`
              : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="num text-3xl font-semibold">{formatUsd(p.price)}</p>
          <p className="text-muted mt-1 text-sm">
            <span className={`num font-medium ${gapTone(p.gapPct)}`}>{formatPct(p.gapPct)}</span> vs{" "}
            <Tip
              text={
                stock.liveReference
                  ? "The live price on the exchange or the overnight venue, so the onchain price has something real to compare against."
                  : "The last regular-session price on Wall Street. While the exchange is shut this is the only anchor; onchain can drift from it."
              }
            >
              {stock.reference.phrase}
            </Tip>{" "}
            {formatUsd(p.reference)} ·{" "}
            <Tip text="Time since the most recent onchain trade of this token. Old means the price may be out of date.">
              updated {p.ageMs == null ? "–" : formatAgo(p.ageMs)}
            </Tip>
          </p>
        </div>
      </header>

      <section className="border-line rounded-lg border bg-surface p-4">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-muted">Last 7 days, onchain price of {p.symbol}. Hover for details.</span>
          <span className="text-muted">
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-soft align-middle" /> Wall Street closed
          </span>
        </div>
        <PriceChart candles={stock.candles} reference={p.reference} referenceLabel={stock.reference.short} now={now} />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2 lg:order-2">
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

        <section className="lg:col-span-3 lg:order-1">
          <h2 className="mb-3 text-sm font-semibold">Where it trades</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {stock.tokens.map((t) => (
              <li key={t.mint} className="border-line rounded-lg border bg-surface p-4">
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{t.issuerName}</span>
                  <span className="text-muted text-xs">{t.symbol}</span>
                </div>
                <p className="text-muted mt-1 text-xs">
                  <Tip text={t.structure}>{t.structureShort}</Tip>
                </p>
                {t.tradability === "none" ? (
                  <p className="text-muted mt-3 text-sm">No onchain price worth showing.</p>
                ) : (
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="num text-lg">{formatUsd(t.price)}</span>
                    <span className={`num text-sm ${gapTone(t.gapPct)}`}>{formatPct(t.gapPct)}</span>
                  </div>
                )}
                <p className="text-muted mt-2 text-xs">
                  <Tip text={TRADABILITY_TIP[t.tradability]}>{TRADABILITY_LABEL[t.tradability]}</Tip>
                  {t.tradability === "none" ? "" : ` · ${formatCompactUsd(t.liquidity)} in pools`}
                </p>
              </li>
            ))}
          </ul>
          {stock.tokens.length > 1 && (
            <p className="text-muted mt-3 text-xs leading-relaxed">
              Same company, different wrappers. Each issuer has its own legal structure, so the tokens are not
              interchangeable. We quote the one with the deepest pool.
            </p>
          )}
        </section>
      </div>
    </>
  );
}

const earningsDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function formatEarningsDate(ymd: string): string {
  return earningsDate.format(new Date(`${ymd}T12:00:00Z`));
}

function gapTone(gap: number | null): string {
  if (gap == null || Math.abs(gap) < 0.25) return "text-muted";
  return gap > 0 ? "text-up" : "text-down";
}
