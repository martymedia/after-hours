"use client";

// Amount picker, a real Jupiter quote for that amount, and a plain verdict:
// is this a good moment to buy, and why or why not. Then the buy button.

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { CostEstimate } from "@/lib/stock-types";
import type { Phase } from "@/lib/market-phase";
import { formatAgo, formatPct, formatUsd } from "@/lib/format";
import { Tip } from "./tip";

// Wallet discovery only exists in the browser; rendering the button on the
// server would produce markup that never matches the client.
const BuyButton = dynamic(() => import("./buy-button").then((m) => m.BuyButton), {
  ssr: false,
  loading: () => (
    <span className="inline-flex items-center rounded-md bg-soft px-4 py-2 text-sm font-medium text-muted">
      Checking wallets…
    </span>
  ),
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

const PRESETS = [100, 1000, 10000];

type Check = { label: string; detail: string; level: "good" | "ok" | "warn" };

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
    <section className="border-line rounded-lg border bg-surface p-5">
      <h2 className="text-base font-semibold">Is now a good moment?</h2>
      <p className="text-muted mt-1 text-xs">Pick an amount. We fetch a real quote and check four things.</p>

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

      <div className="mt-5">
        {disabled ? (
          <p className="text-muted text-sm">This token has no onchain market to quote.</p>
        ) : state === "error" ? (
          <p className="text-warn text-sm">No route found for this amount right now. Try a smaller amount.</p>
        ) : estimate ? (
          <>
            <div className={`rounded-md px-3 py-2 text-sm font-medium ${VERDICT_STYLE[verdict.level]}`}>
              {verdict.text}
            </div>
            <ul className="mt-3 space-y-2">
              {checks.map((c) => (
                <li key={c.label} className="flex items-start gap-2 text-sm">
                  <span className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${DOT[c.level]}`} />
                  <span>
                    <span className="font-medium">{c.label}.</span>{" "}
                    <span className="text-muted">{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-muted mt-4 text-xs">
              {formatUsd(estimate.usd, 0)} buys <span className="num">{estimate.shares.toFixed(4)}</span> {symbol} at{" "}
              <span className="num">{formatUsd(estimate.execPrice)}</span> each ·{" "}
              <Tip text="How much your order alone moves the pool price. Small is good; above 1% means the pool is too thin for this size.">
                price impact {formatPct(estimate.impactPct)}
              </Tip>{" "}
              · via {estimate.route.join(", ")}
              {state === "loading" ? " · updating" : ""}
            </p>
          </>
        ) : (
          <p className="text-muted text-sm">Getting a quote…</p>
        )}
      </div>

      <div className="mt-4">
        <BuyButton mint={mint} symbol={symbol} usd={usd} disabled={disabled} />
      </div>
      <p className="text-muted mt-3 text-xs">
        The swap runs through Jupiter and is signed in your own wallet. After Hours never holds your funds.
        Not investment advice. Not available to US persons.
      </p>
    </section>
  );
}

const VERDICT_STYLE = {
  good: "bg-soft-up text-up",
  ok: "bg-soft text-ink",
  warn: "bg-soft-warn text-warn",
};

const DOT = {
  good: "bg-up",
  ok: "bg-muted",
  warn: "bg-warn",
};

function buildChecks(e: CostEstimate, phase: Phase, ageMs: number | null, liquidity: number, ref: string): Check[] {
  const checks: Check[] = [];

  // 1. Price vs reference
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

  // 2. Freshness
  if (ageMs == null) {
    checks.push({ label: "Freshness", detail: "Unknown.", level: "ok" });
  } else if (ageMs < 5 * 60_000) {
    checks.push({ label: "Freshness", detail: `Last trade ${formatAgo(ageMs)}. The price is current.`, level: "good" });
  } else if (ageMs < 60 * 60_000) {
    checks.push({ label: "Freshness", detail: `Last trade ${formatAgo(ageMs)}. Fine, but not a busy market.`, level: "ok" });
  } else {
    checks.push({ label: "Freshness", detail: `Last trade ${formatAgo(ageMs)}. The price may be out of date.`, level: "warn" });
  }

  // 3. Size vs pool
  if (e.impactPct < 0.3) {
    checks.push({ label: "Size", detail: `This amount moves the pool ${formatPct(e.impactPct)}. Easily absorbed.`, level: "good" });
  } else if (e.impactPct < 1) {
    checks.push({ label: "Size", detail: `This amount moves the pool ${formatPct(e.impactPct)}. Acceptable, splitting it would be cheaper.`, level: "ok" });
  } else {
    checks.push({ label: "Size", detail: `This amount moves the pool ${formatPct(e.impactPct)}. Too big for the pool (${formatUsd(liquidity, 0)}). Split it.`, level: "warn" });
  }

  // 4. Market state
  if (phase === "open") {
    checks.push({ label: "Market", detail: "Wall Street is open. Onchain prices track the exchange closely.", level: "good" });
  } else if (phase === "after_hours") {
    checks.push({ label: "Market", detail: "Wall Street is closed but overnight venues are quoting. The reference is live, just thinner.", level: "ok" });
  } else {
    checks.push({ label: "Market", detail: "Wall Street is closed. The price can gap when it reopens, in either direction.", level: "ok" });
  }

  return checks;
}

function summarize(checks: Check[]): { text: string; level: "good" | "ok" | "warn" } {
  if (checks.length === 0) return { text: "", level: "ok" };
  if (checks.some((c) => c.level === "warn")) return { text: "Better to wait or change the amount.", level: "warn" };
  if (checks.every((c) => c.level === "good")) return { text: "Looks like a fair moment to buy.", level: "good" };
  return { text: "Reasonable, with a caveat below.", level: "ok" };
}
