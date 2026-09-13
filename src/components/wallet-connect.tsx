"use client";

// Shared wallet connection UI. One installed wallet connects on the first
// click; several open a picker; none at all offers Phantom's in-app browser
// (phones) and a Jupiter fallback.

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useConnect, useIsWalletReady, useWallets } from "@solana/kit-plugin-wallet/react";
import { solanaClient } from "@/lib/solana-client";

type Props = {
  label?: string;
  /** Shown as a small link when no wallet is installed. */
  fallbackHref?: string;
  fallbackLabel?: string;
  className?: string;
};

export function ConnectButton({ label = "Connect wallet", fallbackHref, fallbackLabel, className = "btn w-full" }: Props) {
  const ready = useIsWalletReady(solanaClient);
  const wallets = useWallets(solanaClient);
  const { dispatch: connect, isRunning: connecting } = useConnect(solanaClient);
  const [pick, setPick] = useState(false);

  if (!ready) {
    return <span className={`${className} opacity-50`}>Checking wallets…</span>;
  }

  if (wallets.length === 0) {
    const here = typeof window === "undefined" ? "" : window.location.href;
    return (
      <div className="flex flex-col gap-2">
        <a href={`https://phantom.app/ul/browse/${encodeURIComponent(here)}?ref=${encodeURIComponent(here)}`} className={className}>
          Open in Phantom
        </a>
        {fallbackHref && (
          <a href={fallbackHref} target="_blank" rel="noreferrer" className="text-muted hover:text-ink text-center text-xs underline underline-offset-4">
            {fallbackLabel ?? "or continue without a wallet"}
          </a>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className={className}
        disabled={connecting}
        onClick={() => (wallets.length === 1 ? connect(wallets[0]) : setPick(true))}
      >
        {connecting ? "Check your wallet…" : label}
      </button>
      {pick && (
        <WalletPicker
          wallets={wallets.map((w) => ({ name: w.name, icon: w.icon }))}
          busy={connecting}
          onPick={(name) => {
            const w = wallets.find((x) => x.name === name);
            if (w) connect(w);
          }}
          onClose={() => setPick(false)}
        />
      )}
    </>
  );
}

/** Centered picker for the rare case of several installed wallets. */
export function WalletPicker({
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
  const [phase, setPhase] = useState<"open" | "closing" | "init">("init");
  useEffect(() => {
    const id = setTimeout(() => setPhase("open"), 20);
    return () => clearTimeout(id);
  }, []);
  const close = useCallback(() => {
    setPhase("closing");
    setTimeout(onClose, 150);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [close]);

  const cls = phase === "open" ? "is-open" : phase === "closing" ? "is-closing" : "";
  return createPortal(
    <div className={`t-backdrop ${cls} fixed inset-0 z-[90] flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm sm:items-center`} onClick={close} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose a wallet"
        onClick={(e) => e.stopPropagation()}
        className={`t-modal ${cls} w-full max-w-sm rounded-3xl bg-card p-5 shadow-2xl`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Choose a wallet</h3>
            <p className="text-muted mt-1 text-sm">You sign in your own wallet. We never hold funds.</p>
          </div>
          <button type="button" onClick={close} aria-label="Close" className="icon-badge h-8 w-8 shrink-0 hover:bg-soft">
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

export function shortAddress(a: string): string {
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}
