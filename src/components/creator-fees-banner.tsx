"use client";

// Wallet page banner: curves this wallet created that hold trading fees
// for it. Shown only when there is something to claim.

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CreatorClaimable } from "@/lib/curve-trade";
import { formatUsd } from "@/lib/format";
import { ClaimFeesButton } from "./curve-trade";
import { PoolAvatar } from "./pool-avatar";

function fmt(n: number): string {
  if (n === 0) return "0";
  return n >= 1 ? n.toFixed(4) : Number(n.toPrecision(4)).toString();
}

export function CreatorFeesBanner({ owner }: { owner: string }) {
  const [pools, setPools] = useState<CreatorClaimable[]>([]);
  const [claimed, setClaimed] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/curves/creator?owner=${owner}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { pools?: CreatorClaimable[] } | null) => {
        if (!cancelled && b?.pools) setPools(b.pools);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [owner]);
  const open = pools.filter((p) => !claimed.includes(p.pool));
  if (open.length === 0) return null;
  const usd = open.reduce((a, p) => a + (p.usd ?? 0), 0);
  return (
    <section className="rise card-dark relative overflow-hidden p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-blue-light text-xs font-medium">Your curves</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">
            {usd > 0
              ? `${formatUsd(usd)} in fees waiting for you.`
              : "Fees waiting for you."}
          </h2>
          <p className="text-on-dark-muted mt-1 text-sm">
            Trading fees your {open.length === 1 ? "curve" : "curves"} earned.
            Claiming sends them to this wallet; it costs only the network fee.
          </p>
        </div>
        <Link
          href="/curves"
          className="text-on-dark-muted text-sm hover:text-white"
        >
          All curves
        </Link>
      </div>
      <ul className="mt-4 divide-y divide-white/10">
        {open.map((p) => (
          <li key={p.pool} className="flex items-center gap-3 py-3 text-sm">
            <PoolAvatar
              image={null}
              symbol={p.symbol}
              name={p.name}
              size={32}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{p.name}</span>
              <span className="text-on-dark-muted num block text-xs">
                {fmt(p.quoteFee)} {p.quoteSymbol}
                {p.usd != null ? ` ≈ ${formatUsd(p.usd)}` : ""}
                {p.baseFee > 0 ? ` · plus ${fmt(p.baseFee)} of the token` : ""}
              </span>
            </span>
            <ClaimFeesButton
              pool={p.pool}
              label={`Claim ${fmt(p.quoteFee)} ${p.quoteSymbol}`}
              className="btn btn-white btn-sm"
              onDone={() => setClaimed((c) => [...c, p.pool])}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
