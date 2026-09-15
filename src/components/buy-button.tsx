"use client";

// Connect a wallet, build the swap on the server, sign and send it here.
// Connecting lives in wallet-connect.tsx and is shared with the Wallet page.

import { useState } from "react";
import {
  getBase58Decoder,
  getBase64EncodedWireTransaction,
  getBase64Encoder,
  getTransactionDecoder,
} from "@solana/kit";
import { X } from "lucide-react";
import { SuccessCheck, SwapText } from "./motion";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { solanaClient } from "@/lib/solana-client";
import { useWalletReady } from "@/lib/wallet-ready";
import { formatUsd } from "@/lib/format";
import { ConnectButton, shortAddress } from "./wallet-connect";

type Props = {
  mint: string;
  symbol: string;
  /** USDC to spend when buying. */
  usd: number;
  side?: "buy" | "sell";
  /** Shares to sell. */
  shares?: number;
  disabled?: boolean;
  /** Called from the result card's secondary action. */
  onDone?: () => void;
};

type Step =
  "idle" | "building" | "signing" | "confirming" | "pending" | "done" | "error";
type Result = {
  signature: string;
  shares: number | null;
  usd: number;
  ms: number;
  confirmed: boolean;
};

export function BuyButton({
  mint,
  symbol,
  usd,
  side = "buy",
  shares: sharesToSell = 0,
  disabled,
  onDone,
}: Props) {
  const ready = useWalletReady();
  const connected = useConnectedWallet(solanaClient);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<{ title: string; hint: string } | null>(
    null,
  );
  const [result, setResult] = useState<Result | null>(null);

  const baseClass =
    "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium";
  const primary = "btn w-full";

  if (disabled) {
    return (
      <span className={`${baseClass} w-full bg-soft text-muted`}>
        No onchain market
      </span>
    );
  }

  if (!ready) {
    return (
      <span className={`${baseClass} w-full bg-soft text-muted`}>
        Checking wallets…
      </span>
    );
  }

  if (!connected) {
    return (
      <ConnectButton
        label="Connect wallet to buy"
        fallbackHref={`https://jup.ag/swap/USDC-${mint}`}
        fallbackLabel="or buy on Jupiter"
      />
    );
  }

  async function buy() {
    if (!connected?.signer) {
      fail(
        "This wallet cannot sign transactions.",
        "Try Phantom, Backpack or Solflare.",
      );
      return;
    }
    const startedAt = stamp();
    try {
      setStep("building");
      setError(null);
      const res = await fetch("/api/swap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mint,
          usd,
          side,
          shares: sharesToSell,
          userPublicKey: connected.account.address,
        }),
      });
      const body = (await res.json()) as {
        swapTransaction?: string;
        outAmount?: string;
        decimals?: number;
        error?: string;
      };
      if (!res.ok || !body.swapTransaction)
        throw new Error(body.error ?? "could not build the swap");
      const outUi =
        body.outAmount != null && body.decimals != null
          ? Number(body.outAmount) / 10 ** body.decimals
          : null;
      const shares = side === "buy" ? outUi : sharesToSell;
      const usdMoved = side === "buy" ? usd : (outUi ?? 0);

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
        sig = String(
          await solanaClient.rpc
            .sendTransaction(wire, { encoding: "base64" })
            .send(),
        );
      } else {
        throw new Error("Wallet has no signing feature");
      }

      setStep("confirming");
      let confirmed = await waitForConfirmation(sig);
      if (!confirmed) {
        // Not seen onchain within 45 s: show a waiting card and keep looking
        // for three more minutes. Never a success card without confirmation.
        setResult({
          signature: sig,
          shares,
          usd: usdMoved,
          ms: stamp() - startedAt,
          confirmed: false,
        });
        setStep("pending");
        confirmed = await waitForConfirmation(sig, 180_000);
        if (!confirmed) {
          fail(
            "Not confirmed yet.",
            "The network has not picked this up. Check the transaction on Solscan before trying again, so you do not buy twice.",
          );
          return;
        }
      }
      setResult({
        signature: sig,
        shares,
        usd: usdMoved,
        ms: stamp() - startedAt,
        confirmed: true,
      });
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

  const busy =
    step === "building" ||
    step === "signing" ||
    step === "confirming" ||
    step === "pending";

  if (step === "pending" && result) {
    return (
      <div className="rise rounded-3xl border border-line bg-soft p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-white">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue" />
          </span>
          <div className="min-w-0">
            <p className="text-lg leading-tight font-semibold">
              Sent. Waiting for the network.
            </p>
            <p className="text-muted text-sm">
              Your wallet sent it; Solana has not confirmed it yet. This can
              take a minute when the network is busy.
            </p>
          </div>
        </div>
        <a
          href={`https://solscan.io/tx/${result.signature}`}
          target="_blank"
          rel="noreferrer"
          className="btn btn-sm mt-4 w-full border border-line bg-card text-ink hover:bg-soft"
        >
          View on Solscan
        </a>
      </div>
    );
  }

  if (step === "done" && result) {
    const perShare = result.shares ? result.usd / result.shares : null;
    return (
      <div className="rise rounded-3xl bg-ink p-5 text-white">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue">
            <SuccessCheck size={22} />
          </span>
          <div className="min-w-0">
            <p className="text-lg leading-tight font-semibold">
              {side === "buy"
                ? `You own ${symbol} now.`
                : `Sold. USDC is back in your wallet.`}
            </p>
            <p className="text-on-dark-muted text-sm">
              Confirmed onchain in {(result.ms / 1000).toFixed(1)} s.
            </p>
          </div>
        </div>
        <dl className="num mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-white/10 p-3">
            <dt className="text-on-dark-muted text-xs">
              {side === "buy" ? "Shares" : "Sold"}
            </dt>
            <dd className="mt-0.5 font-semibold">
              {result.shares == null ? "–" : result.shares.toFixed(4)}
              {result.shares != null && (
                <span className="text-on-dark-muted font-normal">
                  {" "}
                  {symbol}
                </span>
              )}
            </dd>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <dt className="text-on-dark-muted text-xs">
              {side === "buy" ? "Paid" : "Received"}
            </dt>
            <dd className="mt-0.5 font-semibold">
              {formatUsd(result.usd, 2)}
              {perShare && (
                <span className="text-on-dark-muted font-normal">
                  {" "}
                  · {formatUsd(perShare)} each
                </span>
              )}
            </dd>
          </div>
        </dl>
        <div className="mt-4 flex gap-2">
          <a
            href={`https://solscan.io/tx/${result.signature}`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-white btn-sm flex-1"
          >
            View on Solscan
          </a>
          <button
            type="button"
            onClick={() => (onDone ? onDone() : setStep("idle"))}
            className="btn btn-sm flex-1 border border-white/20 bg-transparent hover:bg-white/10"
          >
            {side === "buy" ? "Buy more" : "Done"}
          </button>
        </div>
        <p className="text-on-dark-muted mt-3 text-xs">
          {side === "buy"
            ? `The tokens sit in your wallet ${shortAddress(connected.account.address)}. Sell any time from the Wallet page.`
            : `Settled in wallet ${shortAddress(connected.account.address)}.`}
        </p>
      </div>
    );
  }

  const STEPS = ["building", "signing", "confirming"] as const;
  const stepIndex = STEPS.indexOf(step as (typeof STEPS)[number]);

  return (
    <div>
      <div className="flex flex-col gap-2">
        <button type="button" className={primary} disabled={busy} onClick={buy}>
          <SwapText
            className={busy ? "t-shimmer" : ""}
            text={
              step === "building"
                ? "Getting the best route…"
                : step === "signing"
                  ? "Confirm in your wallet…"
                  : step === "confirming"
                    ? "Confirming onchain…"
                    : side === "buy"
                      ? `Buy ${formatUsd(usd, 0)} of ${symbol}`
                      : `Sell ${trimShares(sharesToSell)} ${symbol}`
            }
          />
        </button>
        {busy ? (
          <ol
            className="flex items-center justify-center gap-3 text-xs"
            aria-live="polite"
          >
            {STEPS.map((s, i) => {
              const state =
                i < stepIndex ? "done" : i === stepIndex ? "now" : "todo";
              return (
                <li
                  key={s}
                  className={`flex items-center gap-1.5 ${state === "todo" ? "text-muted-2" : state === "now" ? "text-ink" : "text-muted"}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${state === "now" ? "animate-pulse bg-blue" : state === "done" ? "bg-ink" : "bg-line"}`}
                  />
                  {s === "building"
                    ? "Route"
                    : s === "signing"
                      ? "Wallet"
                      : "Onchain"}
                </li>
              );
            })}
          </ol>
        ) : (
          <span className="text-muted num text-center text-xs">
            Wallet {shortAddress(connected.account.address)}
            {side === "buy" && (
              <>
                {" · "}
                <a
                  href={`https://buy.moonpay.com/?currencyCode=usdc_sol&walletAddress=${connected.account.address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4 hover:text-ink"
                >
                  Need USDC? Buy with a card
                </a>
              </>
            )}
          </span>
        )}
      </div>
      {step === "error" && error && (
        <div
          key={error.title}
          className="rise t-shake mt-3 rounded-2xl border border-line bg-soft p-4"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-soft-down text-down">
              <X size={16} strokeWidth={2.5} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{error.title}</p>
              <p className="text-muted mt-0.5 text-sm leading-relaxed">
                {error.hint}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function trimShares(n: number): string {
  return n >= 100 ? n.toFixed(2) : n >= 1 ? n.toFixed(3) : n.toFixed(4);
}

/** Wall clock, kept out of the component so the compiler lint stays quiet. */
const stamp = () => Date.now();

/**
 * Poll the signature through the server (Helius) for up to `timeoutMs`.
 * True once confirmed or finalized; throws "onchain: …" when it failed;
 * false when it was not seen in time (never treat that as success).
 */
export async function waitForConfirmation(
  sig: string,
  timeoutMs = 45_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`/api/tx-status?sig=${sig}`, {
        cache: "no-store",
      });
      const body = (await res.json()) as {
        status?: "unknown" | "pending" | "confirmed" | "failed";
        err?: unknown;
      };
      if (body.status === "failed")
        throw new Error("onchain: " + JSON.stringify(body.err));
      if (body.status === "confirmed") return true;
    } catch (err) {
      if (String((err as Error).message).startsWith("onchain:")) throw err;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

/** Turn wallet and RPC error strings into a title and a next step. */
export function explainError(raw: string): [string, string] {
  const t = raw.toLowerCase();
  if (
    t.includes("user rejected") ||
    t.includes("rejected the request") ||
    t.includes("cancel")
  ) {
    return [
      "Cancelled in your wallet.",
      "Nothing was sent and nothing was charged.",
    ];
  }
  if (
    t.includes("insufficient") &&
    (t.includes("lamport") || t.includes("rent") || t.includes("sol"))
  ) {
    return [
      "Not enough SOL for fees.",
      "Every buy needs a little SOL for the network fee and, the first time, for the token account. Add about 0.02 SOL and try again.",
    ];
  }
  if (t.includes("0x177e") || t.includes("6014")) {
    return [
      "The route needs rebuilding.",
      "Jupiter rejected the fee setup for this token. Try again and a fresh route is built.",
    ];
  }
  if (t.startsWith("unconfirmed:")) {
    return [
      "Not confirmed yet.",
      "The network has not picked this up. Check the Wallet page in a minute before placing it again, so you do not place it twice.",
    ];
  }
  if (t.startsWith("simulation:")) {
    return [
      "This swap would fail onchain.",
      "Jupiter's dry run failed, so nothing was sent. Try again in a moment or with a different amount.",
    ];
  }
  if (t.includes("0x1771") || t.includes("slippage")) {
    return [
      "The price moved too much.",
      "The quote changed while you were confirming. Try again for a fresh quote.",
    ];
  }
  if (
    t.includes("blockhash") ||
    t.includes("expired") ||
    t.includes("block height")
  ) {
    return [
      "The quote expired.",
      "Quotes are valid for about a minute. Try again.",
    ];
  }
  if (t.includes("could not build") || t.includes("no route")) {
    return [
      "No route right now.",
      "Jupiter found no way to fill this order at the moment. Try a smaller amount or another issuer.",
    ];
  }
  if (t.startsWith("onchain:")) {
    if (t.includes("insufficient") || t.includes('"custom":1'))
      return [
        "Not enough SOL in this wallet.",
        "The transaction ran out of SOL for rent and fees. Top the wallet up, or switch to the one you meant to use.",
      ];
    return [
      "The transaction failed onchain.",
      "Your wallet was not charged beyond the network fee. Try again; if it repeats, the amount may be too large for this market.",
    ];
  }
  return [
    "Something went wrong.",
    raw.length > 160 ? raw.slice(0, 160) + "…" : raw,
  ];
}
