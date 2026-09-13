"use client";

// The stock page's trade card: a quick read of what a buy costs right now,
// then two doors. "Buy" opens the full buy flow in a modal, "Set a price and
// sleep" opens the limit order. Both close back to this card.

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { MoonStar } from "lucide-react";
import type { CostEstimate } from "@/lib/stock-types";
import type { Phase } from "@/lib/market-phase";
import { formatUsd, gapTone, gapWords } from "@/lib/format";
import { BuyPanel } from "./buy-panel";
import { Modal, ModalClose } from "./modal";
import { TickerBadge } from "./ticker-badge";

const OrderPanel = dynamic(() => import("./order-panel").then((m) => m.OrderPanel), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-2xl bg-soft" />,
});

type Props = {
  mint: string;
  symbol: string;
  name: string;
  logo: string | null;
  referencePhrase: string;
  phase: Phase;
  ageMs: number | null;
  liquidity: number;
  reference: number | null;
  price: number | null;
  disabled?: boolean;
};

const PREVIEW_USD = 25;

export function TradeCard(props: Props) {
  const { mint, symbol, name, logo, referencePhrase, disabled, reference, price } = props;
  const [open, setOpen] = useState<"buy" | "order" | null>(null);
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);

  useEffect(() => {
    if (disabled) return;
    let cancelled = false;
    fetch(`/api/quote?mint=${mint}&usd=${PREVIEW_USD}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: CostEstimate | null) => {
        if (!cancelled && body) setEstimate(body);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mint, disabled]);

  const vs = estimate?.vsReferencePct ?? null;
  const tone = gapTone(vs);

  return (
    <section className="card p-5 lg:sticky lg:top-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Trade {symbol}</h2>
        <span className="text-muted text-xs">via Jupiter, from your wallet</span>
      </div>

      {disabled ? (
        <p className="text-muted mt-4 text-sm">This token has no onchain market to trade.</p>
      ) : (
        <>
          <div className={`mt-4 rounded-2xl p-4 ${vs == null ? "bg-soft" : vs <= 0 ? "bg-blue text-white" : "bg-down text-white"}`}>
            {estimate ? (
              <>
                <div className="num text-2xl font-semibold">{gapWords(vs) === "in line" ? "In line" : gapWords(vs)}</div>
                <div className={`mt-0.5 text-sm ${vs == null ? "text-muted" : "text-white/80"}`}>
                  than {referencePhrase} for a {formatUsd(PREVIEW_USD, 0)} buy, price impact included.
                </div>
              </>
            ) : (
              <>
                <div className="h-7 w-32 animate-pulse rounded bg-white/20" />
                <div className="mt-2 h-4 w-48 animate-pulse rounded bg-white/20" />
              </>
            )}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 text-sm">
            <div className="flex items-baseline justify-between">
              <dt className="text-muted">Onchain</dt>
              <dd className="num font-medium">{formatUsd(price)}</dd>
            </div>
            <div className="flex items-baseline justify-between">
              <dt className="text-muted">{referencePhrase.replace(/^./, (c) => c.toUpperCase())}</dt>
              <dd className="num font-medium">{formatUsd(reference)}</dd>
            </div>
          </dl>

          <button type="button" className="btn mt-5 w-full" onClick={() => setOpen("buy")}>
            Buy {symbol}
          </button>
          <button type="button" className="btn btn-sm mt-2 w-full border border-line bg-card text-ink hover:bg-soft" onClick={() => setOpen("order")}>
            <MoonStar size={14} strokeWidth={1.75} className="mr-1.5 text-blue" />
            Set a price and sleep
          </button>
          <p className={`mt-3 text-xs ${tone === "text-muted" ? "text-muted" : tone}`}>
            {vs != null && vs > 0.25 ? "Pricier than the last print right now. A limit order waits for a better price." : "Signed in your own wallet. After Hours never holds your funds."}
          </p>
        </>
      )}

      {open === "buy" && (
        <Modal ariaLabel={`Buy ${symbol}`} onClose={() => setOpen(null)}>
          <div className="mb-1 flex items-center gap-3">
            <TickerBadge symbol={symbol} logo={logo} size={40} />
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-lg font-semibold tracking-tight">Buy {name}</h3>
              <p className="text-muted text-xs">{symbol} · via Jupiter</p>
            </div>
            <ModalClose />
          </div>
          <BuyPanel {...props} embedded />
        </Modal>
      )}
      {open === "order" && (
        <Modal ariaLabel={`Set a price for ${symbol}`} onClose={() => setOpen(null)}>
          <div className="mb-1 flex items-center gap-3">
            <TickerBadge symbol={symbol} logo={logo} size={40} />
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-lg font-semibold tracking-tight">Set a price and sleep</h3>
              <p className="text-muted text-xs">A limit buy for {name} that waits onchain</p>
            </div>
            <ModalClose />
          </div>
          <OrderPanel mint={mint} symbol={symbol} reference={reference} price={price} referencePhrase={referencePhrase} disabled={disabled} embedded />
        </Modal>
      )}
    </section>
  );
}
