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
import {
  BuyPanel,
  DOT,
  VERDICT_STYLE,
  buildChecks,
  summarize,
} from "./buy-panel";
import { Modal, ModalClose } from "./modal";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { solanaClient } from "@/lib/solana-client";
import { SellPanel } from "./sell-panel";
import { Seg } from "./motion";
import { TickerBadge } from "./ticker-badge";

const OrderPanel = dynamic(
  () => import("./order-panel").then((m) => m.OrderPanel),
  {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse rounded-2xl bg-soft" />,
  },
);

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
  const {
    mint,
    symbol,
    name,
    logo,
    referencePhrase,
    disabled,
    reference,
    price,
  } = props;
  const [open, setOpen] = useState<"buy" | "order" | "sell" | null>(null);
  const [orderSide, setOrderSide] = useState<"buy" | "sell">("buy");
  // Shares of this stock in the connected wallet, for the Sell door.
  const connected = useConnectedWallet(solanaClient);
  const owner = connected?.account.address ?? null;
  const [held, setHeld] = useState<{ owner: string; amount: number } | null>(
    null,
  );
  const [heldTick, setHeldTick] = useState(0);
  useEffect(() => {
    if (!owner) return;
    let cancelled = false;
    fetch(`/api/holding?owner=${owner}&mint=${mint}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { amount?: number } | null) => {
        if (!cancelled && body && typeof body.amount === "number")
          setHeld({ owner, amount: body.amount });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [owner, mint, heldTick]);
  const heldAmount = held && held.owner === owner ? held.amount : 0;
  // Dust (under 5 cents) cannot be sold; no Sell door for it.
  const canSell =
    heldAmount > 0 && (price == null || heldAmount * price >= 0.05);
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
  const checks = estimate
    ? buildChecks(
        estimate,
        props.phase,
        props.ageMs,
        props.liquidity,
        referencePhrase,
      )
    : [];
  const verdict = checks.length ? summarize(checks) : null;

  return (
    <section className="card p-5 lg:sticky lg:top-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Trade {symbol}</h2>
        <span className="text-muted text-xs">
          via Jupiter, from your wallet
        </span>
      </div>

      {disabled ? (
        <p className="text-muted mt-4 text-sm">
          This token has no onchain market to trade.
        </p>
      ) : (
        <>
          <div
            className={`mt-4 rounded-2xl p-4 ${vs == null ? "bg-soft" : vs <= 0 ? "bg-blue text-white" : "bg-down text-white"}`}
          >
            {estimate ? (
              <>
                <div className="num text-2xl font-semibold">
                  {vs == null
                    ? "No comparison"
                    : gapWords(vs) === "in line"
                      ? "In line"
                      : gapWords(vs)}
                </div>
                <div
                  className={`mt-0.5 text-sm ${vs == null ? "text-muted" : "text-white/80"}`}
                >
                  {vs == null
                    ? `${referencePhrase} is missing for this stock. Quote for a ${formatUsd(PREVIEW_USD, 0)} buy, price impact included.`
                    : `${gapWords(vs) === "in line" ? "with" : "than"} ${referencePhrase} for a ${formatUsd(PREVIEW_USD, 0)} buy, price impact included.`}
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
              <dt className="text-muted">
                {referencePhrase.replace(/^./, (c) => c.toUpperCase())}
              </dt>
              <dd className="num font-medium">{formatUsd(reference)}</dd>
            </div>
          </dl>

          <button
            type="button"
            className="btn mt-5 w-full"
            onClick={() => setOpen("buy")}
          >
            Buy {symbol}
          </button>
          {canSell && (
            <button
              type="button"
              className="btn btn-sm mt-2 w-full border border-line bg-card text-ink hover:bg-soft"
              onClick={() => setOpen("sell")}
            >
              Sell {symbol}
              <span className="num text-muted ml-1.5 font-normal">
                you hold{" "}
                {heldAmount >= 1
                  ? heldAmount.toFixed(3)
                  : heldAmount.toFixed(4)}
              </span>
            </button>
          )}
          <button
            type="button"
            className="btn btn-sm mt-2 w-full border border-line bg-card text-ink hover:bg-soft"
            onClick={() => setOpen("order")}
          >
            <MoonStar
              size={14}
              strokeWidth={1.75}
              className="mr-1.5 text-blue"
            />
            Set a price and sleep
          </button>
          {verdict && (
            <div
              className={`mt-4 rounded-2xl px-4 py-3 text-sm font-medium ${VERDICT_STYLE[verdict.level]}`}
            >
              {verdict.text}
            </div>
          )}
          {checks.length > 0 && (
            <ul className="mt-3 space-y-2">
              {checks.map((c) => (
                <li key={c.label} className="flex items-start gap-2.5 text-sm">
                  <span
                    className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${DOT[c.level]}`}
                  />
                  <span>
                    <span className="font-medium">{c.label}.</span>{" "}
                    <span className="text-muted">{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p
            className={`mt-3 text-xs ${tone === "text-muted" ? "text-muted" : tone}`}
          >
            {vs != null && vs > 0.25
              ? "Pricier than the last print right now. A limit order waits for a better price."
              : "Signed in your own wallet. After Hours never holds your funds."}
          </p>
        </>
      )}

      {open === "sell" && canSell && (
        <SellPanel
          mint={mint}
          symbol={symbol}
          name={name}
          logo={logo}
          held={heldAmount}
          referencePhrase={referencePhrase}
          price={price}
          reference={reference}
          onClose={() => setOpen(null)}
          onSold={() => setTimeout(() => setHeldTick((n) => n + 1), 1500)}
        />
      )}

      {open === "buy" && (
        <Modal ariaLabel={`Buy ${symbol}`} onClose={() => setOpen(null)}>
          <div className="mb-1 flex items-center gap-3">
            <TickerBadge symbol={symbol} logo={logo} size={40} />
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-lg font-semibold tracking-tight">
                Buy {name}
              </h3>
              <p className="text-muted text-xs">{symbol} · via Jupiter</p>
            </div>
            <ModalClose />
          </div>
          <BuyPanel {...props} embedded />
        </Modal>
      )}
      {open === "order" && (
        <Modal
          ariaLabel={`Set a price for ${symbol}`}
          onClose={() => setOpen(null)}
        >
          <div className="mb-1 flex items-center gap-3">
            <TickerBadge symbol={symbol} logo={logo} size={40} />
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-lg font-semibold tracking-tight">
                Set a price and sleep
              </h3>
              <p className="text-muted text-xs">
                A limit order for {name} that waits onchain
              </p>
            </div>
            <ModalClose />
          </div>
          <Seg
            ariaLabel="Order side"
            value={orderSide}
            onChange={setOrderSide}
            options={[
              { id: "buy", label: "Buy below a price" },
              { id: "sell", label: "Sell above a price" },
            ]}
            className="mt-2 w-full justify-between"
          />
          <OrderPanel
            key={orderSide}
            mint={mint}
            symbol={symbol}
            side={orderSide}
            reference={reference}
            price={price}
            referencePhrase={referencePhrase}
            disabled={disabled}
            embedded
          />
        </Modal>
      )}
    </section>
  );
}
