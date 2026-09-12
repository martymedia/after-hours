"use client";

// Amount picker, a real Jupiter quote for that amount, and a plain verdict:
// is this a good moment to buy, and why or why not. Then the buy button.

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { CostEstimate } from "@/lib/stock-types";
import type { Phase } from "@/lib/market-phase";
import { formatAgo, formatPct, formatUsd } from "@/lib/format";
import { Tip } from "./tip";

const BuyButton = dynamic(() => import("./buy-button").then((m) => m.BuyButton), {
  ssr: false,
  loading: () => <span className="btn w-full opacity-50">Checking wallets…</span>,
});

type Props = {
  mint: string;
  symbol: string;
  referencePhrase: string;
  phase: Phase;
  ageMs: number | null;
  liquidity: number;
  disabled?: boolean;
};

const PRESETS = [100, 500, 1000, 5000];

type Level = "good" | "ok" | "warn";
type Check = { label: string; detail: string; level: Level };

export function BuyPanel({ mint, symbol, referencePhrase, phase, ageMs, liquidity, disabled }: Props) {
  const [usd, setUsd] = useState(1000);
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    if (disabled) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setState("loading");
      try {
        const res = await fetch(`/api/quote?mint=${mint}&usd=${usd}`, { cache: "no-store" });
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
  }, [mint, usd, disabled]);

  const checks = estimate ? buildChecks(estimate, phase, ageMs, liquidity, referencePhrase) : [];
  const verdict = summarize(checks);

  return (
    <section className="card sticky top-5 p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Buy {symbol}</h2>
        <span className="text-muted text-xs">via Jupiter</span>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-2xl bg-soft px-4 py-3">
        <span className="text-muted text-lg">$</span>
        <input
          type="number"
          min={1}
          max={250000}
          value={usd}
          onChange={(e) => setUsd(Math.max(1, Math.min(250000, Number(e.target.value) || 0)))}
          className="num w-full bg-transparent text-2xl font-semibold outline-none"
          aria-label="Amount in USD"
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setUsd(p)}
            className={`pill ${usd === p ? "pill-dark" : "bg-soft text-ink hover:bg-line"}`}
          >
            {formatUsd(p, 0)}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {disabled ? (
          <p className="text-muted text-sm">This token has no onchain market to quote.</p>
        ) : state === "error" ? (
          <p className="text-warn text-sm">No route found for this amount right now. Try a smaller amount.</p>
        ) : estimate ? (
          <>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted">You get</span>
              <span className="num font-semibold">
                {estimate.shares.toFixed(4)} {symbol}
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between text-sm">
              <span className="text-muted">Per share</span>
              <span className="num">{formatUsd(estimate.execPrice)}</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between text-sm">
              <span className="text-muted">
                <Tip text="How much your order alone moves the pool price. Small is good; above 1% means the pool is too thin for this size.">Price impact</Tip>
              </span>
              <span className="num">{formatPct(estimate.impactPct)}</span>
            </div>

            <div className={`mt-4 rounded-2xl px-4 py-3 text-sm font-medium ${VERDICT_STYLE[verdict.level]}`}>
              {verdict.text}
            </div>
            <ul className="mt-3 space-y-2">
              {checks.map((c) => (
                <li key={c.label} className="flex items-start gap-2.5 text-sm">
                  <span className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${DOT[c.level]}`} />
                  <span>
                    <span className="font-medium">{c.label}.</span> <span className="text-muted">{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-muted text-sm">Getting a quote…</p>
        )}
      </div>

      <div className="mt-5">
        <BuyButton mint={mint} symbol={symbol} usd={usd} disabled={disabled} />
      </div>
      <p className="text-muted mt-3 text-xs leading-relaxed">
        Signed in your own wallet. After Hours never holds your funds. Not investment advice. Not available to
        US persons.
      </p>
    </section>
  );
}

const VERDICT_STYLE: Record<Level, string> = {
  good: "bg-soft-up text-up",
  ok: "bg-soft text-ink",
  warn: "bg-soft-warn text-warn",
};

const DOT: Record<Level, string> = {
  good: "bg-up",
  ok: "bg-muted-2",
  warn: "bg-warn",
};

function buildChecks(e: CostEstimate, phase: Phase, ageMs: number | null, liquidity: number, ref: string): Check[] {
  const checks: Check[] = [];

  if (e.vsReferencePct == null) {
    checks.push({ label: "Price", detail: "No reference price available.", level: "ok" });
  } else {
    const abs = Math.abs(e.vsReferencePct);
    const dir = e.vsReferencePct >= 0 ? "above" : "below";
    if (abs < 0.5) {
      checks.push({ label: "Price", detail: `Your effective price is ${formatPct(abs)} ${dir} ${ref}. That is in line.`, level: "good" });
    } else if (e.vsReferencePct > 0) {
      checks.push({ label: "Price", detail: `You would pay ${formatPct(abs)} above ${ref}. Waiting may be cheaper.`, level: abs > 2 ? "warn" : "ok" });
    } else {
      checks.push({
        label: "Price",
        detail:
          phase === "closed"
            ? `Onchain is ${formatPct(abs)} below ${ref}. Could be news, could be thin weekend liquidity.`
            : `Onchain is ${formatPct(abs)} below ${ref}. Cheaper than the exchange right now.`,
        level: phase === "closed" ? "ok" : "good",
      });
    }
  }

  if (ageMs == null) {
    checks.push({ label: "Freshness", detail: "Unknown.", level: "ok" });
  } else if (ageMs < 5 * 60_000) {
    checks.push({ label: "Freshness", detail: `Last trade ${formatAgo(ageMs)}. The price is current.`, level: "good" });
  } else if (ageMs < 60 * 60_000) {
    checks.push({ label: "Freshness", detail: `Last trade ${formatAgo(ageMs)}. Fine, but not a busy market.`, level: "ok" });
  } else {
    checks.push({ label: "Freshness", detail: `Last trade ${formatAgo(ageMs)}. The price may be out of date.`, level: "warn" });
  }

  if (e.impactPct < 0.3) {
    checks.push({ label: "Size", detail: `This amount moves the pool ${formatPct(e.impactPct)}. Easily absorbed.`, level: "good" });
  } else if (e.impactPct < 1) {
    checks.push({ label: "Size", detail: `This amount moves the pool ${formatPct(e.impactPct)}. Acceptable; splitting it would be cheaper.`, level: "ok" });
  } else {
    checks.push({ label: "Size", detail: `This amount moves the pool ${formatPct(e.impactPct)}. Too big for the pool (${formatUsd(liquidity, 0)}). Split it.`, level: "warn" });
  }

  if (phase === "open") {
    checks.push({ label: "Market", detail: "Wall Street is open. Onchain prices track the exchange closely.", level: "good" });
  } else if (phase === "after_hours") {
    checks.push({ label: "Market", detail: "Wall Street is closed but overnight venues are quoting. The reference is live, just thinner.", level: "ok" });
  } else {
    checks.push({ label: "Market", detail: "Wall Street is closed. The price can gap when it reopens, in either direction.", level: "ok" });
  }

  return checks;
}

function summarize(checks: Check[]): { text: string; level: Level } {
  if (checks.length === 0) return { text: "", level: "ok" };
  if (checks.some((c) => c.level === "warn")) return { text: "Better to wait or change the amount.", level: "warn" };
  if (checks.every((c) => c.level === "good")) return { text: "Looks like a fair moment to buy.", level: "good" };
  return { text: "Reasonable, with a caveat below.", level: "ok" };
}
