import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getStock } from "@/lib/stock";
import { formatAgo, formatCompactUsd, formatPct, formatUsd } from "@/lib/format";
import { TRADABILITY_LABEL } from "@/lib/radar-types";
import { PriceChart } from "@/components/price-chart";
import { CostCalculator } from "@/components/cost-calculator";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ symbol: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { symbol } = await params;
  const stock = getStock(symbol);
  return { title: stock ? `${stock.name} (${stock.underlying})` : "Not found" };
}

export default async function StockPage({ params }: Props) {
  const { symbol } = await params;
  const stock = getStock(symbol);
  if (!stock) notFound();

  const now = Date.parse(stock.generatedAt);
  const p = stock.primary;

  return (
    <>
      <Link href="/" className="text-muted text-sm hover:underline">
        ← All stocks
      </Link>

      <header className="mt-4 mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{stock.name}</h1>
          <p className="text-muted mt-1 text-sm">
            {stock.underlying} · {stock.tokens.length} {stock.tokens.length === 1 ? "issuer" : "issuers"} on Solana
          </p>
        </div>
        <div className="text-right">
          <p className="num text-3xl font-semibold">{formatUsd(p.price)}</p>
          <p className="text-muted mt-1 text-sm">
            <span className={`num font-medium ${gapTone(p.gapPct)}`}>{formatPct(p.gapPct)}</span> vs{" "}
            {stock.reference.phrase} {formatUsd(p.reference)} · updated{" "}
            {p.ageMs == null ? "–" : formatAgo(p.ageMs)}
          </p>
        </div>
      </header>

      <section className="border-line rounded-lg border bg-surface p-4">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-muted">Last 7 days, onchain price of {p.symbol}</span>
          <span className="text-muted">
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-soft align-middle" /> Wall Street closed
          </span>
        </div>
        <PriceChart candles={stock.candles} reference={p.reference} referenceLabel={stock.reference.short} now={now} />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <h2 className="mb-3 text-sm font-semibold">Where it trades</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {stock.tokens.map((t) => (
              <li key={t.mint} className="border-line rounded-lg border bg-surface p-4">
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{t.issuerName}</span>
                  <span className="text-muted text-xs">{t.symbol}</span>
                </div>
                <p className="text-muted mt-1 text-xs">{t.structureShort}</p>
                {t.tradability === "none" ? (
                  <p className="text-muted mt-3 text-sm">No onchain price worth showing.</p>
                ) : (
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="num text-lg">{formatUsd(t.price)}</span>
                    <span className={`num text-sm ${gapTone(t.gapPct)}`}>{formatPct(t.gapPct)}</span>
                  </div>
                )}
                <p className="text-muted mt-2 text-xs">
                  {TRADABILITY_LABEL[t.tradability]}
                  {t.tradability === "none" ? "" : ` · ${formatCompactUsd(t.liquidity)} in pools`}
                </p>
                <p className="text-muted mt-3 text-xs leading-relaxed">{t.structure}</p>
              </li>
            ))}
          </ul>
        </section>

        <div className="lg:col-span-2">
          <CostCalculator
            mint={p.mint}
            symbol={p.symbol}
            referencePhrase={stock.reference.phrase}
            liveReference={stock.liveReference}
            disabled={p.tradability === "none"}
          />
        </div>
      </div>
    </>
  );
}

function gapTone(gap: number | null): string {
  if (gap == null || Math.abs(gap) < 0.25) return "text-muted";
  return gap > 0 ? "text-up" : "text-down";
}
