"use client";

// Wallet page: the curves this wallet created. Addresses to copy, how far
// each curve is, and the trading fees waiting to be claimed.

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CreatorCurve } from "@/lib/curve-trade";
import { formatUsd } from "@/lib/format";
import { ClaimFeesButton } from "./curve-trade";
import { CopyField } from "./copy-field";
import { PoolAvatar } from "./pool-avatar";

function fmt(n: number): string {
  if (n === 0) return "0";
  return n >= 1 ? n.toFixed(4) : Number(n.toPrecision(4)).toString();
}

export function YourCurves({ owner }: { owner: string }) {
  const [curves, setCurves] = useState<CreatorCurve[] | null>(null);
  const [claimed, setClaimed] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/curves/creator?owner=${owner}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { pools?: CreatorCurve[] } | null) => {
        if (!cancelled && b?.pools) setCurves(b.pools);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [owner]);
  if (!curves || curves.length === 0) return null;
  const waiting = curves.filter(
    (c) => c.quoteFee > 0 && !claimed.includes(c.pool),
  );
  const usd = waiting.reduce((a, c) => a + (c.usd ?? 0), 0);
  return (
    <section className="rise card p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Your curves</h2>
          <p className="text-muted text-sm">
            {waiting.length > 0
              ? `${usd > 0 ? formatUsd(usd) : "Fees"} in trading fees waiting for you. Claiming sends them to this wallet.`
              : `${curves.length === 1 ? "One curve" : `${curves.length} curves`} launched from this wallet. Trading fees land here as people trade.`}
          </p>
        </div>
        <Link href="/curves/build" className="btn btn-sm">
          Build another
        </Link>
      </div>
      <ul className="mt-3 divide-y divide-line">
        {curves.map((c) => {
          const pct = Math.round(c.progress * 100);
          const open = c.quoteFee > 0 && !claimed.includes(c.pool);
          return (
            <li key={c.pool} className="py-4">
              <div className="flex items-center gap-3">
                <PoolAvatar
                  image={c.image}
                  symbol={c.symbol}
                  name={c.name}
                  size={36}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {c.name}
                    {c.symbol && (
                      <span className="text-muted ml-1.5 text-xs font-normal">
                        {c.symbol}
                      </span>
                    )}
                  </div>
                  <div className="text-muted num text-xs">
                    {c.migrated
                      ? "graduated"
                      : `${pct < 1 ? "<1" : pct}% of the way to graduation`}
                    {" · "}
                    {fmt(c.raisedQuote)} {c.quoteSymbol} raised
                    {open
                      ? ` · ${fmt(c.quoteFee)} ${c.quoteSymbol} in fees for you`
                      : ""}
                  </div>
                </div>
                {open ? (
                  <ClaimFeesButton
                    pool={c.pool}
                    label={`Claim ${fmt(c.quoteFee)} ${c.quoteSymbol}`}
                    className="btn btn-sm"
                    onDone={() => setClaimed((s) => [...s, c.pool])}
                  />
                ) : (
                  <Link
                    href={`/curves/${c.underlying}`}
                    className="btn btn-sm border border-line bg-card text-ink hover:bg-soft"
                  >
                    {c.quoteSymbol} curves
                  </Link>
                )}
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <CopyField label="Pool" value={c.pool} />
                <CopyField label="Token mint" value={c.baseMint} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
