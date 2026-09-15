"use client";

// The curves of one stock. Search matches name, symbol, pool or mint
// address, so a creator can paste what the builder gave them. When a
// wallet is connected, rows carry what that wallet created and holds.

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import type { CurvePool } from "@/lib/curves";
import { solanaClient } from "@/lib/solana-client";
import { PoolRow, type PoolStockInfo } from "./curve-pool-row";

const PAGE = 20;

export function CurvePoolList({
  pools,
  symbol,
  stock,
  title,
  note,
  search = true,
}: {
  pools: CurvePool[];
  symbol: string;
  stock: PoolStockInfo;
  title: string;
  note: string;
  search?: boolean;
}) {
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const connected = useConnectedWallet(solanaClient);
  const owner = connected?.account.address ?? null;

  useEffect(() => {
    if (!owner) return;
    let cancelled = false;
    fetch(`/api/balances?owner=${owner}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { amounts?: Record<string, number> } | null) => {
        if (!cancelled && b?.amounts) setAmounts(b.amounts);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [owner]);

  const needle = search ? q.trim().toLowerCase() : "";
  const hits = needle
    ? pools.filter((p) =>
        [p.name, p.symbol ?? "", p.pool, p.baseMint].some((s) =>
          s.toLowerCase().includes(needle),
        ),
      )
    : pools;
  const shown = needle || all ? hits : hits.slice(0, PAGE);
  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <span className="text-muted num text-xs">{note}</span>
        </div>
        {search && (
          <label className="flex h-9 w-full items-center gap-2 rounded-full bg-soft px-3 sm:w-64">
            <Search
              size={14}
              strokeWidth={1.75}
              className="text-muted shrink-0"
            />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, symbol or address"
              aria-label="Search curves"
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>
        )}
      </div>
      {shown.length === 0 ? (
        <p className="text-muted mt-4 text-sm">
          Nothing here matches &ldquo;{q.trim()}&rdquo;. A curve created a
          moment ago can take a minute to appear.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {shown.map((p) => (
            <PoolRow
              key={p.pool}
              p={p}
              symbol={symbol}
              stock={stock}
              held={amounts[p.baseMint] ?? null}
              mine={owner != null && p.creator === owner}
            />
          ))}
        </ul>
      )}
      {!needle && hits.length > PAGE && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="btn btn-sm mx-auto mt-2 flex w-fit border border-line bg-card text-ink hover:bg-soft"
        >
          {all ? "Show fewer" : `Show ${hits.length - PAGE} more`}
        </button>
      )}
    </section>
  );
}
