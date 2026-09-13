"use client";

// Sell a position back to USDC: pick how much, see a real quote for that size
// against the reference price, then sign in the wallet. Opens as a modal from
// the Wallet page.

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { CostEstimate } from "@/lib/stock-types";
import { formatPct, formatUsd } from "@/lib/format";
import { TickerBadge } from "./ticker-badge";

const BuyButton = dynamic(() => import("./buy-button").then((m) => m.BuyButton), {
  ssr: false,
  loading: () => <span className="btn w-full opacity-50">Checking wallets…</span>,
});

type Props = {
  mint: string;
  symbol: string;
  name: string;
  logo: string | null;
  held: number;
  referencePhrase: string;
  onClose: () => void;
  /** Called after a confirmed sale so the page can refresh. */
  onSold: () => void;
};

const PARTS = [0.25, 0.5, 0.75, 1];

export function SellPanel({ mint, symbol, name, logo, held, referencePhrase, onClose, onSold }: Props) {
  const [fraction, setFraction] = useState(1);
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [phase, setPhase] = useState<"init" | "open" | "closing">("init");
  const shares = Number((held * fraction).toFixed(6));

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

  useEffect(() => {
    if (shares <= 0) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setState("loading");
      try {
        const res = await fetch(`/api/quote?mint=${mint}&side=sell&shares=${shares}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as CostEstimate;
        if (!cancelled) {
          setEstimate(body);
          setState("idle");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mint, shares]);

  const cls = phase === "open" ? "is-open" : phase === "closing" ? "is-closing" : "";
  const vs = estimate?.vsReferencePct ?? null;
  const vsTone = vs == null || Math.abs(vs) < 0.25 ? "text-muted" : vs > 0 ? "text-up" : "text-down";

  return createPortal(
    <div className={`t-backdrop ${cls} fixed inset-0 z-[90] flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm sm:items-center`} onClick={close} role="presentation">
      <div role="dialog" aria-modal="true" aria-label={`Sell ${symbol}`} onClick={(e) => e.stopPropagation()} className={`t-modal ${cls} w-full max-w-md rounded-3xl bg-card p-5 shadow-2xl`}>
        <div className="flex items-center gap-3">
          <TickerBadge symbol={symbol} logo={logo} size={40} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-semibold tracking-tight">Sell {name}</h3>
            <p className="text-muted num text-xs">You hold {trim(held)} {symbol}</p>
          </div>
          <button type="button" onClick={close} aria-label="Close" className="icon-badge h-8 w-8 shrink-0 hover:bg-soft">
            <span aria-hidden="true" className="text-base leading-none">×</span>
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-soft px-4 py-3">
          <input
            type="number"
            min={0}
            max={held}
            step="any"
            value={shares}
            onChange={(e) => {
              const v = Math.max(0, Math.min(held, Number(e.target.value) || 0));
              setFraction(held > 0 ? v / held : 0);
            }}
            className="num w-full bg-transparent text-2xl font-semibold outline-none"
            aria-label="Shares to sell"
          />
          <span className="text-muted text-sm">{symbol}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PARTS.map((p) => (
            <button key={p} type="button" onClick={() => setFraction(p)} className={`pill ${fraction === p ? "pill-dark" : "bg-soft text-ink hover:bg-line"}`}>
              {p === 1 ? "All" : `${p * 100}%`}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {state === "error" ? (
            <p className="text-warn text-sm">No route for this amount right now. Try a smaller amount.</p>
          ) : estimate ? (
            <div className="rounded-2xl bg-ink p-4 text-white">
              <p className="text-on-dark-muted text-xs">You get, after price impact</p>
              <p className="num mt-1 text-3xl font-semibold">{formatUsd(estimate.usd)}</p>
              <p className={`num mt-1 text-sm ${vsTone}`}>
                {formatUsd(estimate.execPrice)} per share
                {vs != null && Math.abs(vs) >= 0.25 ? ` · ${Math.abs(vs).toFixed(2)}% ${vs > 0 ? "above" : "below"} ${referencePhrase}` : vs != null ? ` · in line with ${referencePhrase}` : ""}
              </p>
              {estimate.impactPct > 1 && <p className="text-warn mt-2 text-xs">This size moves the pool {formatPct(estimate.impactPct)}. Selling in parts would get more.</p>}
              {estimate.feeBps ? <p className="text-on-dark-muted mt-2 text-xs">Includes our {(estimate.feeBps / 100).toFixed(2)}% fee.</p> : null}
            </div>
          ) : (
            <div className="h-24 animate-pulse rounded-2xl bg-soft" />
          )}
        </div>

        <div className="mt-4">
          <BuyButton mint={mint} symbol={symbol} usd={0} side="sell" shares={shares} disabled={shares <= 0 || state === "error"} onDone={() => {
            onSold();
            close();
          }} />
        </div>
        <p className="text-muted mt-3 text-xs">Swapped to USDC on Jupiter, signed in your wallet. We never hold your tokens.</p>
      </div>
    </div>,
    document.body,
  );
}

function trim(n: number): string {
  return n >= 100 ? n.toFixed(2) : n >= 1 ? n.toFixed(3) : n.toFixed(4);
}
