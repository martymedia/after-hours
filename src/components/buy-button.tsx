"use client";

// Connect a wallet, build the swap on the server, sign and send it here.
// One installed wallet connects on the first click; several open a picker.
// No wallet at all: open the page inside Phantom, or fall back to Jupiter.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  getBase58Decoder,
  getBase64EncodedWireTransaction,
  getBase64Encoder,
  getTransactionDecoder,
  signature as toSignature,
} from "@solana/kit";
import { Check, X } from "lucide-react";
import { useConnect, useConnectedWallet, useIsWalletReady, useWallets } from "@solana/kit-plugin-wallet/react";
import { solanaClient } from "@/lib/solana-client";
import { formatUsd } from "@/lib/format";

type Props = { mint: string; symbol: string; usd: number; disabled?: boolean };

type Step = "idle" | "building" | "signing" | "confirming" | "done" | "error";
type Result = { signature: string; shares: number | null; ms: number; confirmed: boolean };

export function BuyButton({ mint, symbol, usd, disabled }: Props) {
  const ready = useIsWalletReady(solanaClient);
  const wallets = useWallets(solanaClient);
  const connected = useConnectedWallet(solanaClient);
  const { dispatch: connect, isRunning: connecting } = useConnect(solanaClient);
  const [pickWallet, setPickWallet] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<{ title: string; hint: string } | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const baseClass = "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium";
  const primary = "btn w-full";

  if (disabled) {
    return <span className={`${baseClass} w-full bg-soft text-muted`}>No onchain market</span>;
  }

  if (!ready) {
    return <span className={`${baseClass} w-full bg-soft text-muted`}>Checking wallets…</span>;
  }

  if (!connected) {
    if (wallets.length === 0) {
      const here = typeof window === "undefined" ? "" : window.location.href;
      return (
        <div className="flex flex-col gap-2">
          <a href={`https://phantom.app/ul/browse/${encodeURIComponent(here)}?ref=${encodeURIComponent(here)}`} className={primary}>
            Open in Phantom to buy
          </a>
          <a href={`https://jup.ag/swap/USDC-${mint}`} target="_blank" rel="noreferrer" className="text-muted hover:text-ink text-center text-xs underline underline-offset-4">
            or buy on Jupiter
          </a>
        </div>
      );
    }
    return (
      <>
        <button
          type="button"
          className={primary}
          disabled={connecting}
          onClick={() => (wallets.length === 1 ? connect(wallets[0]) : setPickWallet(true))}
        >
          {connecting ? "Check your wallet…" : "Connect wallet to buy"}
        </button>
        {pickWallet && (
          <WalletPicker
            wallets={wallets.map((w) => ({ name: w.name, icon: w.icon }))}
            busy={connecting}
            onPick={(name) => {
              const w = wallets.find((x) => x.name === name);
              if (w) connect(w);
            }}
            onClose={() => setPickWallet(false)}
          />
        )}
      </>
    );
  }

  async function buy() {
    if (!connected?.signer) {
      fail("This wallet cannot sign transactions.", "Try Phantom, Backpack or Solflare.");
      return;
    }
    const startedAt = stamp();
    try {
      setStep("building");
      setError(null);
      const res = await fetch("/api/swap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mint, usd, userPublicKey: connected.account.address }),
      });
      const body = (await res.json()) as { swapTransaction?: string; outAmount?: string; decimals?: number; error?: string };
      if (!res.ok || !body.swapTransaction) throw new Error(body.error ?? "could not build the swap");
      const shares = body.outAmount != null && body.decimals != null ? Number(body.outAmount) / 10 ** body.decimals : null;

      setStep("signing");
      const bytes = getBase64Encoder().encode(body.swapTransaction);
      const tx = getTransactionDecoder().decode(bytes);
      const signer = connected.signer;

      let sig: string;
      if ("signAndSendTransactions" in signer) {
        const [raw] = await signer.signAndSendTransactions([tx]);
        sig = getBase58Decoder().decode(raw);
      } else if ("modifyAndSignTransactions" in signer) {
        const [signed] = await signer.modifyAndSignTransactions([tx]);
        const wire = getBase64EncodedWireTransaction(signed);
        sig = String(await solanaClient.rpc.sendTransaction(wire, { encoding: "base64" }).send());
      } else {
        throw new Error("Wallet has no signing feature");
      }

      setStep("confirming");
      const confirmed = await waitForConfirmation(sig);
      setResult({ signature: sig, shares, ms: stamp() - startedAt, confirmed });
      setStep("done");
    } catch (err) {
      const [title, hint] = explainError((err as Error).message ?? String(err));
      fail(title, hint);
    }
  }

  function fail(title: string, hint: string) {
    setStep("error");
    setError({ title, hint });
  }

  const busy = step === "building" || step === "signing" || step === "confirming";

  if (step === "done" && result) {
    const perShare = result.shares ? usd / result.shares : null;
    return (
      <div className="rise rounded-3xl bg-ink p-5 text-white">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue">
            <Check size={20} strokeWidth={2.5} />
          </span>
          <div className="min-w-0">
            <p className="text-lg leading-tight font-semibold">You own {symbol} now.</p>
            <p className="text-on-dark-muted text-sm">
              {result.confirmed ? `Confirmed onchain in ${(result.ms / 1000).toFixed(1)} s.` : "Sent. Confirmation is taking a moment."}
            </p>
          </div>
        </div>
        <dl className="num mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-white/10 p-3">
            <dt className="text-on-dark-muted text-xs">Shares</dt>
            <dd className="mt-0.5 font-semibold">{result.shares == null ? "–" : result.shares.toFixed(4)}</dd>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <dt className="text-on-dark-muted text-xs">Paid</dt>
            <dd className="mt-0.5 font-semibold">
              {formatUsd(usd, 2)}
              {perShare && <span className="text-on-dark-muted font-normal"> · {formatUsd(perShare)} each</span>}
            </dd>
          </div>
        </dl>
        <div className="mt-4 flex gap-2">
          <a href={`https://solscan.io/tx/${result.signature}`} target="_blank" rel="noreferrer" className="btn btn-white btn-sm flex-1">
            View on Solscan
          </a>
          <button type="button" onClick={() => setStep("idle")} className="btn btn-sm flex-1 border border-white/20 bg-transparent hover:bg-white/10">
            Buy more
          </button>
        </div>
        <p className="text-on-dark-muted mt-3 text-xs">The tokens sit in your wallet {shortAddress(connected.account.address)}. Sell any time on Jupiter.</p>
      </div>
    );
  }

  const STEPS = ["building", "signing", "confirming"] as const;
  const stepIndex = STEPS.indexOf(step as (typeof STEPS)[number]);

  return (
    <div>
      <div className="flex flex-col gap-2">
        <button type="button" className={primary} disabled={busy} onClick={buy}>
          {step === "building"
            ? "Getting the best route…"
            : step === "signing"
              ? "Confirm in your wallet…"
              : step === "confirming"
                ? "Confirming onchain…"
                : `Buy ${formatUsd(usd, 0)} of ${symbol}`}
        </button>
        {busy ? (
          <ol className="flex items-center justify-center gap-3 text-xs" aria-live="polite">
            {STEPS.map((s, i) => {
              const state = i < stepIndex ? "done" : i === stepIndex ? "now" : "todo";
              return (
                <li key={s} className={`flex items-center gap-1.5 ${state === "todo" ? "text-muted-2" : state === "now" ? "text-ink" : "text-muted"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${state === "now" ? "animate-pulse bg-blue" : state === "done" ? "bg-ink" : "bg-line"}`} />
                  {s === "building" ? "Route" : s === "signing" ? "Wallet" : "Onchain"}
                </li>
              );
            })}
          </ol>
        ) : (
          <span className="text-muted num text-center text-xs">Wallet {shortAddress(connected.account.address)}</span>
        )}
      </div>
      {step === "error" && error && (
        <div className="rise mt-3 rounded-2xl border border-line bg-soft p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-soft-down text-down">
              <X size={16} strokeWidth={2.5} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{error.title}</p>
              <p className="text-muted mt-0.5 text-sm leading-relaxed">{error.hint}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Wall clock, kept out of the component so the compiler lint stays quiet. */
const stamp = () => Date.now();

/** Poll the signature for up to 45 s. True once confirmed or finalized. */
async function waitForConfirmation(sig: string): Promise<boolean> {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try {
      const res = await solanaClient.rpc.getSignatureStatuses([toSignature(sig)], { searchTransactionHistory: true }).send();
      const st = res.value[0];
      if (st?.err) throw new Error("onchain: " + JSON.stringify(st.err));
      if (st && (st.confirmationStatus === "confirmed" || st.confirmationStatus === "finalized")) return true;
    } catch (err) {
      if (String((err as Error).message).startsWith("onchain:")) throw err;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

/** Turn wallet and RPC error strings into a title and a next step. */
function explainError(raw: string): [string, string] {
  const t = raw.toLowerCase();
  if (t.includes("user rejected") || t.includes("rejected the request") || t.includes("cancel")) {
    return ["Cancelled in your wallet.", "Nothing was sent and nothing was charged."];
  }
  if (t.includes("insufficient") && (t.includes("lamport") || t.includes("rent") || t.includes("sol"))) {
    return [
      "Not enough SOL for fees.",
      "Every buy needs a little SOL for the network fee and, the first time, for the token account. Add about 0.02 SOL and try again.",
    ];
  }
  if (t.includes("0x1771") || t.includes("slippage")) {
    return ["The price moved too much.", "The quote changed while you were confirming. Try again for a fresh quote."];
  }
  if (t.includes("blockhash") || t.includes("expired") || t.includes("block height")) {
    return ["The quote expired.", "Quotes are valid for about a minute. Try again."];
  }
  if (t.includes("could not build") || t.includes("no route")) {
    return ["No route right now.", "Jupiter found no way to fill this order at the moment. Try a smaller amount or another issuer."];
  }
  if (t.startsWith("onchain:")) {
    return [
      "The transaction failed onchain.",
      "Your wallet was not charged beyond the network fee. Try again; if it repeats, the pool may be too thin for this size.",
    ];
  }
  return ["Something went wrong.", raw.length > 160 ? raw.slice(0, 160) + "…" : raw];
}

/** Centered picker for the rare case of several installed wallets. */
function WalletPicker({
  wallets,
  busy,
  onPick,
  onClose,
}: {
  wallets: { name: string; icon: string }[];
  busy: boolean;
  onPick: (name: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose a wallet"
        onClick={(e) => e.stopPropagation()}
        className="rise w-full max-w-sm rounded-3xl bg-card p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Choose a wallet</h3>
            <p className="text-muted mt-1 text-sm">You sign in your own wallet. We never hold funds.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="icon-badge h-8 w-8 shrink-0 hover:bg-soft">
            <span aria-hidden="true" className="text-base leading-none">×</span>
          </button>
        </div>
        <ul className="mt-4 flex flex-col gap-2">
          {wallets.map((w) => (
            <li key={w.name}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onPick(w.name)}
                className="flex w-full items-center gap-3 rounded-2xl border border-line px-3 py-2.5 text-left transition hover:border-ink hover:bg-soft disabled:opacity-60"
              >
                {/* Wallet icons are data URIs from the extension; next/image adds nothing here. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={w.icon} alt="" className="h-9 w-9 rounded-xl" />
                <span className="flex-1 font-medium">{w.name}</span>
                <span className="text-muted text-xs">{busy ? "Connecting…" : "Detected"}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}

function shortAddress(a: string): string {
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}
