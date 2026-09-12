"use client";

import { useEffect, useState } from "react";
import type { CostEstimate } from "@/lib/stock-types";
import { formatPct, formatUsd } from "@/lib/format";

type Props = {
  mint: string;
  symbol: string;
  referencePhrase: string;
  liveReference: boolean;
  disabled?: boolean;
};

const PRESETS = [100, 1000, 10000];

export function CostCalculator({ mint, symbol, referencePhrase, liveReference, disabled }: Props) {
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

  const verdict = estimate ? verdictFor(estimate, liveReference) : null;

  return (
    <section className="border-line rounded-lg border bg-surface p-5">
      <h2 className="text-sm font-semibold">What would it cost?</h2>
      <p className="text-muted mt-1 text-xs">
        A real quote for this amount, including the price impact your order would have on the pool.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setUsd(p)}
            className={`rounded-full border px-3 py-1 text-sm ${
              usd === p ? "border-ink bg-ink text-paper" : "border-line text-ink hover:bg-soft"
            }`}
          >
            {formatUsd(p, 0)}
          </button>
        ))}
        <label className="flex items-center gap-1 text-sm">
          <span className="text-muted">$</span>
          <input
            type="number"
            min={1}
            max={250000}
            value={usd}
            onChange={(e) => setUsd(Math.max(1, Math.min(250000, Number(e.target.value) || 0)))}
            className="border-line num w-28 rounded-md border bg-paper px-2 py-1 text-sm"
          />
        </label>
      </div>

      <div className="mt-5 min-h-[4.5rem]">
        {disabled ? (
          <p className="text-muted text-sm">This token has no onchain market to quote.</p>
        ) : state === "error" ? (
          <p className="text-warn text-sm">No route found for this amount right now.</p>
        ) : estimate ? (
          <>
            <p className="text-sm leading-relaxed">
              {formatUsd(estimate.usd, 0)} buys{" "}
              <span className="num font-medium">{estimate.shares.toFixed(4)}</span> {symbol} at{" "}
              <span className="num font-medium">{formatUsd(estimate.execPrice)}</span> each.
              {estimate.vsReferencePct != null && (
                <>
                  {" "}
                  That is{" "}
                  <span className={`num font-medium ${toneClass(estimate.vsReferencePct)}`}>
                    {formatPct(Math.abs(estimate.vsReferencePct))}
                  </span>{" "}
                  {estimate.vsReferencePct >= 0 ? "above" : "below"} {referencePhrase}.
                </>
              )}
            </p>
            {verdict && <p className={`mt-2 text-sm ${verdict.tone}`}>{verdict.text}</p>}
            <p className="text-muted mt-2 text-xs">
              Price impact {formatPct(estimate.impactPct)} · via {estimate.route.join(", ")}
              {state === "loading" ? " · updating" : ""}
            </p>
          </>
        ) : (
          <p className="text-muted text-sm">Getting a quote…</p>
        )}
      </div>

      <a
        href={`https://jup.ag/swap/USDC-${mint}`}
        target="_blank"
        rel="noreferrer"
        className={`mt-4 inline-block rounded-md px-4 py-2 text-sm font-medium ${
          disabled ? "bg-soft text-muted pointer-events-none" : "bg-ink text-paper hover:opacity-90"
        }`}
      >
        Buy on Jupiter
      </a>
      <p className="text-muted mt-3 text-xs">
        You trade from your own wallet on Jupiter. After Hours never holds your funds. Not investment advice.
      </p>
    </section>
  );
}

function toneClass(pct: number): string {
  if (Math.abs(pct) < 0.25) return "text-ink";
  return pct > 0 ? "text-down" : "text-up";
}

function verdictFor(e: CostEstimate, liveReference: boolean): { text: string; tone: string } | null {
  if (e.impactPct > 1) {
    return {
      text: "This amount moves the pool by more than 1%. Split it or pick a smaller size.",
      tone: "text-warn",
    };
  }
  if (e.vsReferencePct == null) return null;
  if (!liveReference) {
    return {
      text:
        Math.abs(e.vsReferencePct) < 0.5
          ? "Close to the last close. Remember the real market is shut; the price can gap when it reopens."
          : "The onchain market has moved since the close. That may be news, or thin liquidity.",
      tone: "text-muted",
    };
  }
  if (e.vsReferencePct > 0.5) return { text: "You would pay noticeably more than the exchange price.", tone: "text-warn" };
  if (e.vsReferencePct < -0.5) return { text: "Cheaper than the exchange price right now.", tone: "text-up" };
  return { text: "In line with the exchange price.", tone: "text-muted" };
}
