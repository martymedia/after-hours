"use client";

// Connect a wallet, build the swap on the server, sign and send it here.
// Falls back to a plain Jupiter link when no wallet is installed.

import { useState } from "react";
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
      return (
        <a href={`https://jup.ag/swap/USDC-${mint}`} target="_blank" rel="noreferrer" className={primary}>
          Buy on Jupiter
        </a>
      );
    }
    if (!pickWallet) {
      return (
        <button type="button" className={primary} onClick={() => setPickWallet(true)}>
          Connect wallet to buy
        </button>
      );
    }
    return (
      <div className="flex flex-wrap gap-2">
        {wallets.map((w) => (
          <button
            key={w.name}
            type="button"
            disabled={connecting}
            onClick={() => connect(w)}
            className={`${baseClass} border border-line bg-card hover:bg-soft`}
          >
            {/* Wallet icons are data URIs from the extension; next/image adds nothing here. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={w.icon} alt="" className="mr-2 h-4 w-4 rounded-sm" />
            {w.name}
          </button>
        ))}
      </div>
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

function shortAddress(a: string): string {
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}
