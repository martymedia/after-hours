"use client";

// "Set a price and sleep": a limit order that waits onchain. Buy below a
// price with USDC, or sell shares above a price. The order sits in a Jupiter
// Trigger account owned by the user's wallet; Jupiter fills it if the onchain
// price reaches the target, and it can be cancelled any time. Rendered inside
// a modal, which owns the header.

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import {
  getBase58Decoder,
  getBase64Encoder,
  getTransactionDecoder,
} from "@solana/kit";
import {
  useConnectedWallet,
  useIsWalletReady,
} from "@solana/kit-plugin-wallet/react";
import Link from "next/link";
import { X } from "lucide-react";
import { solanaClient } from "@/lib/solana-client";
import { formatUsd } from "@/lib/format";
import { explainError, waitForConfirmation } from "./buy-button";
import { Seg, SuccessCheck, SwapText } from "./motion";
import { Tip } from "./tip";

const ConnectButton = dynamic(
  () => import("./wallet-connect").then((m) => m.ConnectButton),
  {
    ssr: false,
    loading: () => (
      <span className="btn w-full opacity-50">Checking wallets…</span>
    ),
  },
);

type Props = {
  mint: string;
  symbol: string;
  side?: "buy" | "sell";
  /** Shares in the wallet, when known (wallet page); enables the percent presets. */
  held?: number;
  /** Last reference (Wall Street) price. */
  reference: number | null;
  /** Current onchain price; the target is set relative to it. */
  price: number | null;
  referencePhrase: string;
  disabled?: boolean;
  embedded?: boolean;
};

const AMOUNTS = [25, 50, 100, 500];
const STEPS = [2, 3, 5, 10];
const PARTS = [0.1, 0.25, 0.5, 1];
type DayId = "1" | "3" | "7" | "30";
const DAYS: { id: DayId; label: string }[] = [
  { id: "1", label: "1 day" },
  { id: "3", label: "3 days" },
  { id: "7", label: "7 days" },
  { id: "30", label: "30 days" },
];
const MIN_USD = 5;

type Step = "idle" | "building" | "signing" | "confirming" | "done" | "error";

function Notice({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rise mt-2 flex h-full min-h-[18rem] flex-col items-center justify-center rounded-2xl bg-soft p-6 text-center">
      <p className="font-medium">{title}</p>
      <p className="text-muted mt-1 max-w-xs text-sm">{hint}</p>
      {children}
    </div>
  );
}

export function OrderPanel({
  mint,
  symbol,
  side = "buy",
  held: heldProp,
  reference,
  price,
  referencePhrase,
  disabled,
}: Props) {
  const base = price ?? reference ?? null;
  // Holding of this token: given by the wallet page, fetched on stock pages once a wallet is connected.
  const [heldFetched, setHeldFetched] = useState<number | null>(null);
  const [lookupFailed, setLookupFailed] = useState(false);
  const held = heldProp ?? heldFetched ?? undefined;
  const [usd, setUsd] = useState(25);
  const [usdText, setUsdText] = useState("25");
  const [sharesText, setSharesText] = useState(
    heldProp ? String(Number(heldProp.toFixed(6))) : "1",
  );
  const [pct, setPct] = useState(3);
  const [customText, setCustomText] = useState<string | null>(null);
  const [days, setDays] = useState<DayId>("7");
  const ready = useIsWalletReady(solanaClient);
  const connected = useConnectedWallet(solanaClient);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<{ title: string; hint: string } | null>(
    null,
  );
  const [placed, setPlaced] = useState<{
    signature: string;
    shares: number;
    target: number;
    usd: number;
  }>();

  const sell = side === "sell";
  const owner = connected?.account.address ?? null;

  useEffect(() => {
    if (!sell || heldProp != null || !owner) return;
    let cancelled = false;
    fetch(`/api/holding?owner=${owner}&mint=${mint}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { amount?: number } | null) => {
        if (cancelled) return;
        if (!body || typeof body.amount !== "number") {
          setLookupFailed(true);
          return;
        }
        setHeldFetched(body.amount);
        setSharesText(
          body.amount > 0 ? String(Number(body.amount.toFixed(6))) : "0",
        );
      })
      .catch(() => {
        if (!cancelled) setLookupFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [sell, heldProp, owner, mint]);

  const presetTarget = base
    ? Number((base * (1 + (sell ? pct : -pct) / 100)).toFixed(2))
    : null;
  const custom =
    customText == null ? null : Number(customText.replace(",", "."));
  const target =
    customText == null
      ? presetTarget
      : custom != null && Number.isFinite(custom) && custom > 0
        ? custom
        : null;
  const sharesIn = Number(sharesText.replace(",", "."));
  const shares = sell
    ? Number.isFinite(sharesIn) && sharesIn > 0
      ? sharesIn
      : null
    : target
      ? usd / target
      : null;
  const usdOut = sell && shares && target ? shares * target : usd;
  const vsRef =
    target && reference ? ((target - reference) / reference) * 100 : null;
  const vsNow = target && price ? ((target - price) / price) * 100 : null;
  const fillsNow =
    price != null &&
    target != null &&
    (sell ? target <= price : target >= price);
  const tooSmall = sell ? usdOut < MIN_USD : usd < MIN_USD;
  const overHeld =
    sell && held != null && shares != null && shares > held + 1e-9;
  const busy =
    step === "building" || step === "signing" || step === "confirming";

  async function place() {
    if (!connected?.signer || !target || !shares) return;
    try {
      setStep("building");
      setError(null);
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mint,
          side,
          usd,
          shares,
          targetPrice: target,
          days: Number(days),
          userPublicKey: connected.account.address,
        }),
      });
      const body = (await res.json()) as {
        transaction?: string;
        shares?: number;
        usd?: number;
        error?: string;
      };
      if (!res.ok || !body.transaction)
        throw new Error(body.error ?? "could not build the order");
      setStep("signing");
      const tx = getTransactionDecoder().decode(
        getBase64Encoder().encode(body.transaction),
      );
      const signer = connected.signer;
      if (!("signAndSendTransactions" in signer))
        throw new Error("Wallet has no signing feature");
      const [raw] = await signer.signAndSendTransactions([tx]);
      const sig = getBase58Decoder().decode(raw);
      setStep("confirming");
      await waitForConfirmation(sig);
      setPlaced({
        signature: sig,
        shares: body.shares ?? shares,
        target,
        usd: body.usd ?? usdOut,
      });
      setStep("done");
    } catch (err) {
      const [title, hint] = explainError((err as Error).message ?? String(err));
      setStep("error");
      setError({ title, hint });
    }
  }

  if (disabled || !base)
    return (
      <Notice
        title="No onchain market yet."
        hint={`${symbol} has no pool deep enough for a limit order.`}
      />
    );

  // The states before the form are laid over the (hidden) form, so the box
  // keeps the form's exact height and the modal does not jump between sides.
  const notice = !ready ? (
    <Notice title="Checking wallets…" hint="One moment." />
  ) : !connected ? (
    <Notice
      title="Connect your wallet first."
      hint={
        sell
          ? `We read how much ${symbol} you hold and set the order up from there.`
          : "The order is placed from your wallet, so we need to know which one."
      }
    >
      <div className="mx-auto mt-4 w-full max-w-xs">
        <ConnectButton label="Connect wallet" />
      </div>
    </Notice>
  ) : sell && held != null && held <= 0 ? (
    <Notice
      title="Nothing to sell yet."
      hint={`This wallet holds no ${symbol}. Buy some first, or set a buy order that waits for a lower price.`}
    />
  ) : null;

  if (step === "done" && placed) {
    return (
      <div className="rise mt-4 rounded-2xl bg-ink p-5 text-white">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue">
            <SuccessCheck size={22} />
          </span>
          <div>
            <p className="text-lg leading-tight font-semibold">Order placed.</p>
            <p className="text-on-dark-muted text-sm">
              {sell
                ? `Sells ${placed.shares.toFixed(4)} ${symbol} for about ${formatUsd(placed.usd)} if the price reaches ${formatUsd(placed.target)}.`
                : `Buys about ${placed.shares.toFixed(4)} ${symbol} if the price reaches ${formatUsd(placed.target)}.`}
            </p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Link href="/wallet" className="btn btn-white btn-sm flex-1">
            See open orders
          </Link>
          <a
            href={`https://solscan.io/tx/${placed.signature}`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-sm flex-1 border border-white/20 bg-transparent hover:bg-white/10"
          >
            Solscan
          </a>
        </div>
        <p className="text-on-dark-muted mt-3 text-xs">
          The order account belongs to your wallet. Cancel any time from the
          Wallet page; {sell ? "unsold shares" : "unfilled USDC"} come straight
          back.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {notice && <div className="absolute inset-0">{notice}</div>}
      <div
        className={`mt-2 flex flex-col gap-5 ${notice ? "invisible" : ""}`}
        inert={notice ? true : undefined}
        aria-hidden={notice ? true : undefined}
      >
        {/* Amount */}
        <div>
          <p className="text-muted mb-1.5 text-xs font-medium">
            {sell ? "Sell" : "Spend"}
          </p>
          {sell ? (
            <>
              <label className="flex items-center gap-2 rounded-2xl bg-soft px-4 py-3">
                <input
                  type="text"
                  inputMode="decimal"
                  value={sharesText}
                  onChange={(e) => setSharesText(e.target.value)}
                  placeholder="0.00"
                  className="num w-full bg-transparent text-2xl font-semibold outline-none"
                  aria-label="Shares to sell"
                />
                <span className="text-muted text-sm">{symbol}</span>
              </label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PARTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    disabled={!held}
                    onClick={() =>
                      held &&
                      setSharesText(String(Number((held * p).toFixed(6))))
                    }
                    className={`pill ${held && Math.abs(sharesIn - held * p) < 1e-6 ? "pill-dark" : "bg-soft text-ink hover:bg-line disabled:opacity-50"}`}
                  >
                    {p === 1 ? "All" : `${p * 100}%`}
                  </button>
                ))}
                <span className="text-muted num ml-auto self-center text-xs">
                  {held
                    ? `you hold ${held >= 1 ? held.toFixed(3) : held.toFixed(4)}`
                    : lookupFailed
                      ? "balance unknown"
                      : "reading balance…"}
                </span>
              </div>
            </>
          ) : (
            <>
              <label className="flex items-center gap-2 rounded-2xl bg-soft px-4 py-3">
                <span className="text-muted text-lg">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={usdText}
                  onChange={(e) => {
                    setUsdText(e.target.value);
                    const v = Number(e.target.value.replace(",", "."));
                    if (Number.isFinite(v))
                      setUsd(Math.max(MIN_USD, Math.min(250000, v)));
                  }}
                  onBlur={() => setUsdText(String(usd))}
                  className="num w-full bg-transparent text-2xl font-semibold outline-none"
                  aria-label="USDC to spend"
                />
                <span className="text-muted text-sm">USDC</span>
              </label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {AMOUNTS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => {
                      setUsd(a);
                      setUsdText(String(a));
                    }}
                    className={`pill ${usd === a ? "pill-dark" : "bg-soft text-ink hover:bg-line"}`}
                  >
                    {formatUsd(a, 0)}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Target */}
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <p className="text-muted text-xs font-medium">
              {sell
                ? "Sell when the price is at or above"
                : "Buy when the price is at or below"}
            </p>
            <span className="text-muted num text-xs">
              now {formatUsd(price)}
            </span>
          </div>
          <label className="flex items-center gap-2 rounded-2xl bg-soft px-4 py-3">
            <span className="text-muted text-lg">$</span>
            <input
              type="text"
              inputMode="decimal"
              value={
                customText ??
                (presetTarget != null ? presetTarget.toFixed(2) : "")
              }
              onChange={(e) => setCustomText(e.target.value)}
              className="num w-full bg-transparent text-2xl font-semibold outline-none"
              aria-label="Target price"
            />
            <span className="text-muted text-sm">per share</span>
          </label>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {STEPS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setCustomText(null);
                  setPct(d);
                }}
                className={`pill justify-center ${customText == null && pct === d ? "pill-dark" : "bg-soft text-ink hover:bg-line"}`}
              >
                {d}% {sell ? "over" : "under"}
              </button>
            ))}
          </div>
        </div>

        {/* Lifetime */}
        <div>
          <p className="text-muted mb-1.5 text-xs font-medium">
            Keep the order open for
          </p>
          <Seg
            ariaLabel="Order lifetime"
            value={days}
            onChange={setDays}
            options={DAYS}
            className="w-full justify-between"
          />
        </div>

        {/* Summary */}
        <div
          className={`flex min-h-32 flex-col justify-center rounded-2xl p-4 ${fillsNow || overHeld || tooSmall ? "bg-soft-warn" : "bg-ink text-white"}`}
        >
          {!target || !shares ? (
            <p className="text-muted text-sm">
              {sell ? "Enter how many shares to sell." : "Pick a price."}
            </p>
          ) : overHeld ? (
            <p className="text-warn text-sm">
              That is more than the {held?.toFixed(4)} {symbol} in this wallet.
            </p>
          ) : fillsNow ? (
            <p className="text-warn text-sm">
              {formatUsd(target)} is {sell ? "at or below" : "at or above"} the
              current price, so this would fill right away. Use{" "}
              {sell ? "Sell now" : "Buy"} instead, or pick a{" "}
              {sell ? "higher" : "lower"} price.
            </p>
          ) : tooSmall ? (
            <p className="text-warn text-sm">
              Orders need at least {formatUsd(MIN_USD, 0)} of value.
            </p>
          ) : (
            <>
              <p className="text-on-dark-muted text-xs">
                {sell ? "You get, if it fills" : "You get, if it fills"}
              </p>
              <p className="num mt-1 text-2xl font-semibold">
                {sell
                  ? `about ${formatUsd(usdOut)}`
                  : `about ${shares.toFixed(4)} ${symbol}`}
              </p>
              <p className="text-on-dark-muted num mt-1 text-sm">
                {sell
                  ? `for ${shares.toFixed(4)} ${symbol} at ${formatUsd(target)}`
                  : `at ${formatUsd(target)} per share`}
                {vsNow != null
                  ? `, ${Math.abs(vsNow).toFixed(1)}% ${vsNow < 0 ? "under" : "over"} now`
                  : ""}
                {vsRef != null
                  ? `, ${Math.abs(vsRef).toFixed(1)}% ${vsRef < 0 ? "under" : "over"} ${referencePhrase}`
                  : ""}
                .
              </p>
            </>
          )}
        </div>

        <div>
          {!ready ? (
            <span className="btn w-full opacity-50">Checking wallets…</span>
          ) : !connected ? (
            <ConnectButton
              label="Connect wallet to place the order"
              className="btn w-full"
            />
          ) : (
            <button
              type="button"
              className="btn w-full"
              disabled={
                busy || !target || !shares || fillsNow || tooSmall || overHeld
              }
              onClick={place}
            >
              <SwapText
                className={busy ? "t-shimmer" : ""}
                text={
                  step === "building"
                    ? "Preparing the order…"
                    : step === "signing"
                      ? "Confirm in your wallet…"
                      : step === "confirming"
                        ? "Placing onchain…"
                        : sell
                          ? `Place sell order for ${shares ? `${shares.toFixed(4)} ${symbol}` : symbol}`
                          : `Place order for ${formatUsd(usd, 0)}`
                }
              />
            </button>
          )}
          {step === "error" && error && (
            <div
              key={error.title}
              className="rise t-shake mt-3 rounded-2xl border border-line bg-soft p-4"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-soft-down text-down">
                  <X size={16} strokeWidth={2.5} />
                </span>
                <div>
                  <p className="text-sm font-semibold">{error.title}</p>
                  <p className="text-muted mt-0.5 text-sm leading-relaxed">
                    {error.hint}
                  </p>
                </div>
              </div>
            </div>
          )}
          <p className="text-muted mt-3 text-xs leading-relaxed">
            Your {sell ? "shares move" : "USDC moves"} into an order account
            that belongs to your wallet, not to us, and{" "}
            {sell ? "come" : "comes"} back if the order expires or you cancel.{" "}
            <Tip text="Jupiter Trigger, the same limit-order system as on jup.ag. Jupiter charges 0.1% on fills; After Hours adds nothing on orders.">
              Minimum {formatUsd(MIN_USD, 0)}.
            </Tip>
          </p>
        </div>
      </div>
    </div>
  );
}
