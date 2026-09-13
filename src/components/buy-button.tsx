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
} from "@solana/kit";
import { useConnect, useConnectedWallet, useIsWalletReady, useWallets } from "@solana/kit-plugin-wallet/react";
import { solanaClient } from "@/lib/solana-client";
import { formatUsd } from "@/lib/format";

type Props = { mint: string; symbol: string; usd: number; disabled?: boolean };

type Step = "idle" | "building" | "signing" | "sent" | "error";

export function BuyButton({ mint, symbol, usd, disabled }: Props) {
  const ready = useIsWalletReady(solanaClient);
  const wallets = useWallets(solanaClient);
  const connected = useConnectedWallet(solanaClient);
  const { dispatch: connect, isRunning: connecting } = useConnect(solanaClient);
  const [pickWallet, setPickWallet] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [message, setMessage] = useState<string>("");
  const [signature, setSignature] = useState<string>("");

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
      setStep("error");
      setMessage("This wallet cannot sign transactions.");
      return;
    }
    try {
      setStep("building");
      setMessage("");
      const res = await fetch("/api/swap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mint, usd, userPublicKey: connected.account.address }),
      });
      const body = (await res.json()) as { swapTransaction?: string; error?: string };
      if (!res.ok || !body.swapTransaction) throw new Error(body.error ?? "could not build the swap");

      setStep("signing");
      const bytes = getBase64Encoder().encode(body.swapTransaction);
      const tx = getTransactionDecoder().decode(bytes);
      const signer = connected.signer;

      if ("signAndSendTransactions" in signer) {
        const [sig] = await signer.signAndSendTransactions([tx]);
        setSignature(getBase58Decoder().decode(sig));
      } else if ("modifyAndSignTransactions" in signer) {
        const [signed] = await signer.modifyAndSignTransactions([tx]);
        const wire = getBase64EncodedWireTransaction(signed);
        const sig = await solanaClient.rpc.sendTransaction(wire, { encoding: "base64" }).send();
        setSignature(String(sig));
      } else {
        throw new Error("Wallet has no signing feature");
      }
      setStep("sent");
    } catch (err) {
      const text = (err as Error).message ?? String(err);
      setStep("error");
      setMessage(text.includes("User rejected") ? "You cancelled in the wallet." : text);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          className={primary}
          disabled={step === "building" || step === "signing"}
          onClick={buy}
        >
          {step === "building"
            ? "Preparing…"
            : step === "signing"
              ? "Confirm in wallet…"
              : `Buy ${formatUsd(usd, 0)} of ${symbol}`}
        </button>
        <span className="text-muted num text-center text-xs">Wallet {shortAddress(connected.account.address)}</span>
      </div>
      {step === "sent" && (
        <p className="text-up mt-3 text-sm">
          Sent.{" "}
          <a href={`https://solscan.io/tx/${signature}`} target="_blank" rel="noreferrer" className="underline">
            View the transaction
          </a>
          . Your {symbol} lands in this wallet once it confirms.
        </p>
      )}
      {step === "error" && <p className="text-down mt-3 text-sm">{message}</p>}
    </div>
  );
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
