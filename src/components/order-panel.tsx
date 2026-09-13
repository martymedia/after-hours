"use client";

// "Set a price and sleep": a limit buy that waits onchain. The order sits in
// a Jupiter Trigger account owned by the user's wallet; Jupiter fills it if
// the onchain price reaches the target, and it can be cancelled any time.

import dynamic from "next/dynamic";
import { useState } from "react";
import { getBase58Decoder, getBase64Encoder, getTransactionDecoder } from "@solana/kit";
import { useConnectedWallet, useIsWalletReady } from "@solana/kit-plugin-wallet/react";
import Link from "next/link";
import { MoonStar, X } from "lucide-react";
import { solanaClient } from "@/lib/solana-client";
import { formatUsd } from "@/lib/format";
import { explainError, waitForConfirmation } from "./buy-button";
import { SuccessCheck, SwapText } from "./motion";
import { Tip } from "./tip";

const ConnectButton = dynamic(() => import("./wallet-connect").then((m) => m.ConnectButton), {
  ssr: false,
  loading: () => <span className="btn w-full opacity-50">Checking wallets…</span>,
});

type Props = {
  mint: string;
  symbol: string;
  /** Last reference (Wall Street) price. */
  reference: number | null;
  /** Current onchain price, used when there is no reference. */
  price: number | null;
  referencePhrase: string;
  disabled?: boolean;
  /** Rendered inside a modal: no card frame and no title. */
  embedded?: boolean;
};

const DISCOUNTS = [2, 3, 5, 10];
const MIN_USD = 5;

type Step = "idle" | "building" | "signing" | "confirming" | "done" | "error";

export function OrderPanel({ mint, symbol, reference, price, referencePhrase, disabled, embedded = false }: Props) {
  // Base the target on the live onchain price, so the order actually waits;
  // the reference is shown alongside for context.
  const base = price ?? reference ?? null;
  const [usd, setUsd] = useState(25);
  const [discount, setDiscount] = useState(3);
  const [custom, setCustom] = useState<number | null>(null);
  const [days, setDays] = useState(7);
  const ready = useIsWalletReady(solanaClient);
  const connected = useConnectedWallet(solanaClient);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<{ title: string; hint: string } | null>(null);
  const [placed, setPlaced] = useState<{ signature: string; shares: number; target: number } | null>(null);

  const target = custom ?? (base ? Number((base * (1 - discount / 100)).toFixed(2)) : null);
  const shares = target ? usd / target : null;
  const busy = step === "building" || step === "signing" || step === "confirming";

  async function place() {
    if (!connected?.signer || !target) return;
    try {
      setStep("building");
      setError(null);
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mint, usd, targetPrice: target, days, userPublicKey: connected.account.address }),
      });
      const body = (await res.json()) as { transaction?: string; shares?: number; error?: string };
      if (!res.ok || !body.transaction) throw new Error(body.error ?? "could not build the order");
      setStep("signing");
      const tx = getTransactionDecoder().decode(getBase64Encoder().encode(body.transaction));
      const signer = connected.signer;
      if (!("signAndSendTransactions" in signer)) throw new Error("Wallet has no signing feature");
      const [raw] = await signer.signAndSendTransactions([tx]);
      const sig = getBase58Decoder().decode(raw);
      setStep("confirming");
      await waitForConfirmation(sig);
      setPlaced({ signature: sig, shares: body.shares ?? shares ?? 0, target });
      setStep("done");
    } catch (err) {
      const [title, hint] = explainError((err as Error).message ?? String(err));
      setStep("error");
      setError({ title, hint });
    }
  }

  if (disabled || !base) return null;

  return (
    <section className={embedded ? "" : "card p-5"}>
      <div className="flex items-start justify-between gap-3">
        <div>
          {!embedded && (
            <h2 className="flex items-center gap-2 font-semibold">
              <MoonStar size={16} strokeWidth={1.75} className="text-blue" />
              Set a price and sleep
            </h2>
          )}
          <p className="text-muted mt-1 text-sm">
            A limit buy that waits onchain while Wall Street is closed. Fills only if {symbol} reaches your price.
          </p>
        </div>
        <Tip
          text="The order is a Jupiter Trigger account owned by your wallet, not by us. Your USDC sits there until it fills, expires or you cancel from the Wallet page. Jupiter charges 0.1% on fills."
          underline={false}
          className="text-muted shrink-0 text-xs"
        >
          How it works
        </Tip>
      </div>

      {step === "done" && placed ? (
        <div className="rise mt-4 rounded-2xl bg-ink p-4 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue">
              <SuccessCheck size={20} />
            </span>
            <div>
              <p className="font-semibold">Order placed.</p>
              <p className="text-on-dark-muted text-sm">
                Buys about {placed.shares.toFixed(4)} {symbol} if the price reaches {formatUsd(placed.target)}.
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Link href="/wallet" className="btn btn-white btn-sm flex-1">
              See open orders
            </Link>
            <a href={`https://solscan.io/tx/${placed.signature}`} target="_blank" rel="noreferrer" className="btn btn-sm flex-1 border border-white/20 bg-transparent hover:bg-white/10">
              Solscan
            </a>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="rounded-2xl bg-soft p-3">
              <span className="text-muted block text-xs">Spend</span>
              <span className="flex items-center gap-1">
                <span className="text-muted">$</span>
                <input
                  type="number"
                  min={MIN_USD}
                  max={250000}
                  value={usd}
                  onChange={(e) => setUsd(Math.max(MIN_USD, Math.min(250000, Number(e.target.value) || 0)))}
                  className="num w-full bg-transparent text-xl font-semibold outline-none"
                  aria-label="USDC to spend"
                />
              </span>
            </label>
            <label className="rounded-2xl bg-soft p-3">
              <span className="text-muted block text-xs">Buy at or below</span>
              <span className="flex items-center gap-1">
                <span className="text-muted">$</span>
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={target ?? ""}
                  onChange={(e) => setCustom(Math.max(0.01, Number(e.target.value) || 0))}
                  className="num w-full bg-transparent text-xl font-semibold outline-none"
                  aria-label="Target price"
                />
              </span>
            </label>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {DISCOUNTS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setCustom(null);
                  setDiscount(d);
                }}
                className={`pill ${custom == null && discount === d ? "pill-dark" : "bg-soft text-ink hover:bg-line"}`}
              >
                {d}% under now
              </button>
            ))}
            <span className="text-muted ml-auto text-xs">
              for{" "}
              <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-full bg-soft px-2 py-0.5 text-ink outline-none" aria-label="Order lifetime">
                {[1, 3, 7, 14, 30].map((d) => (
                  <option key={d} value={d} className="text-ink">
                    {d} {d === 1 ? "day" : "days"}
                  </option>
                ))}
              </select>
            </span>
          </div>
          <p className="text-muted mt-3 text-sm">
            {target && shares ? (
              <>
                Buys about <span className="num text-ink">{shares.toFixed(4)} {symbol}</span> if the onchain price reaches{" "}
                <span className="num text-ink">{formatUsd(target)}</span>
                {reference ? <> ({(((target - reference) / reference) * 100).toFixed(1)}% vs {referencePhrase})</> : null}. Until then your USDC waits in the order.
                {price != null && target >= price && <span className="text-warn"> That is at or above the current price, so it fills right away; use Buy instead.</span>}
              </>
            ) : (
              "Pick a price."
            )}
          </p>
          <div className="mt-4">
            {!ready ? (
              <span className="btn w-full opacity-50">Checking wallets…</span>
            ) : !connected ? (
              <ConnectButton label="Connect wallet to place the order" className="btn w-full" />
            ) : (
              <button type="button" className="btn w-full" disabled={busy || !target || usd < MIN_USD} onClick={place}>
                <SwapText
                  className={busy ? "t-shimmer" : ""}
                  text={
                    step === "building"
                      ? "Preparing the order…"
                      : step === "signing"
                        ? "Confirm in your wallet…"
                        : step === "confirming"
                          ? "Placing onchain…"
                          : `Place order for ${formatUsd(usd, 0)}`
                  }
                />
              </button>
            )}
          </div>
          {step === "error" && error && (
            <div key={error.title} className="rise t-shake mt-3 rounded-2xl border border-line bg-soft p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-soft-down text-down">
                  <X size={16} strokeWidth={2.5} />
                </span>
                <div>
                  <p className="text-sm font-semibold">{error.title}</p>
                  <p className="text-muted mt-0.5 text-sm leading-relaxed">{error.hint}</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
