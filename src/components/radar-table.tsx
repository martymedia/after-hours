"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { RadarData, RadarRow, Tradability } from "@/lib/radar-types";
import { TRADABILITY_LABEL } from "@/lib/radar-types";
import { formatAgo, formatDuration, formatPct, formatUsd } from "@/lib/format";
import { Sparkline } from "./sparkline";
import { TickerBadge } from "./ticker-badge";
import { Tip } from "./tip";

const REFRESH_MS = 15_000;

const PILL: Record<Tradability, string> = {
  easy: "bg-soft-up text-up",
  ok: "bg-soft text-ink",
  thin: "bg-soft-warn text-warn",
  stale: "bg-soft-warn text-warn",
  none: "bg-soft text-muted",
};

const TRADABILITY_TIP: Record<Tradability, string> = {
  easy: "More than 500k USD in pools. Orders up to a few thousand dollars barely move the price.",
  ok: "Between 50k and 500k USD in pools. Fine for small amounts; large orders move the price.",
  thin: "Very little liquidity. Expect a bad price on anything but tiny orders.",
  stale: "Last trade more than an hour ago. The price may not be where it would trade now.",
  none: "No pool with real liquidity on Solana.",
};

const dayFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "long", hour: "numeric", minute: "2-digit" });
const earningsDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

type Filter = "all" | "xstocks" | "backpack";

export function RadarTable({ initial }: { initial: RadarData }) {
  const [data, setData] = useState(initial);
  const [now, setNow] = useState(() => Date.parse(initial.generatedAt));
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(async () => {
      try {
        const res = await fetch("/api/radar", { cache: "no-store" });
        if (res.ok) setData((await res.json()) as RadarData);
      } catch {
        // keep showing the last good data
      }
    }, REFRESH_MS);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, []);

  const ref = data.reference;
  const closed = data.phase.phase !== "open";
  const rows = data.rows.filter((r) => filter === "all" || r.issuer === filter);

  return (
    <div className="flex flex-col gap-5">
      <section className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {closed ? "Wall Street is closed." : "Wall Street is open."}{" "}
            <span className="text-muted font-normal">{data.rows.length} stocks are trading onchain.</span>
          </h2>
          <p className="text-muted mt-1 text-sm">
            {closed
              ? `Opens ${dayFormatter.format(new Date(data.phase.nextOpen))} ET, in ${formatDuration(new Date(data.phase.nextOpen).getTime() - now)}. Prices compare to ${ref.phrase} and can drift.`
              : "Onchain prices track the exchange closely right now."}
            {data.earnings.length > 0 && (
              <>
                {" "}
                Earnings ahead:{" "}
                {data.earnings.map((e, i) => (
                  <span key={`${e.underlying}-${e.date}`}>
                    {i > 0 ? ", " : ""}
                    <Link href={`/stock/${e.underlying}`} className="text-ink hover:underline">
                      {e.name}
                    </Link>{" "}
                    {earningsDate.format(new Date(`${e.date}T12:00:00Z`))}
                  </span>
                ))}
                .
              </>
            )}
          </p>
        </div>
        <div className="seg" role="group" aria-label="Issuer">
          {(["all", "xstocks", "backpack"] as Filter[]).map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f === "xstocks" ? "xStocks" : "Backpack"}
            </button>
          ))}
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted border-b border-line text-left text-xs">
                <th className="px-5 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 text-right font-medium">
                  <Tip text="The last trade of the most liquid token for this stock on Solana.">Onchain</Tip>
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  <Tip text={data.liveReference ? "The live exchange or overnight-venue price." : `${ref.short} is the last regular-session price. While the exchange is shut, onchain can drift from it.`}>
                    {ref.short}
                  </Tip>
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  <Tip text={`Onchain price versus ${ref.phrase}. Small differences are normal; a few percent means the onchain market has moved on its own.`}>
                    Difference
                  </Tip>
                </th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Last 48h</th>
                <th className="px-4 py-3 text-right font-medium">
                  <Tip text="Time since the most recent onchain trade. Old means the price may be out of date.">Updated</Tip>
                </th>
                <th className="px-4 py-3 pr-5 font-medium">
                  <Tip text="How much money sits in this token's pools, in plain words. It decides how big an order can be before the price moves.">
                    Tradability
                  </Tip>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Row key={row.underlying} row={row} elapsedMs={now - Date.parse(data.generatedAt)} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Row({ row, elapsedMs }: { row: RadarRow; elapsedMs: number }) {
  const ageMs = row.ageMs == null ? null : row.ageMs + elapsedMs;
  return (
    <tr className="border-b border-line last:border-b-0">
      <td className="px-5 py-3">
        <Link href={`/stock/${row.underlying}`} className="group flex items-center gap-3">
          <TickerBadge symbol={row.symbol} size={32} />
          <span className="flex flex-col">
            <span className="font-medium group-hover:underline">{row.name}</span>
            <span className="text-muted text-xs">
              {row.symbol} · {row.issuerName}
              {row.issuerCount > 1 ? ` · +${row.issuerCount - 1}` : ""}
            </span>
          </span>
        </Link>
      </td>
      <td className="num px-4 py-3 text-right font-medium">{formatUsd(row.price)}</td>
      <td className="num text-muted px-4 py-3 text-right">{formatUsd(row.reference)}</td>
      <td className={`num px-4 py-3 text-right font-medium ${gapClass(row.gapPct)}`}>{formatPct(row.gapPct)}</td>
      <td className="hidden px-4 py-3 md:table-cell">
        <Sparkline values={row.spark} color="var(--blue)" />
      </td>
      <td className="num text-muted px-4 py-3 text-right text-xs">{ageMs == null ? "–" : formatAgo(Math.max(0, ageMs))}</td>
      <td className="px-4 py-3 pr-5">
        <span className="group relative inline-flex">
          <span tabIndex={0} className={`pill cursor-help outline-none ${PILL[row.tradability]}`}>
            {TRADABILITY_LABEL[row.tradability]}
          </span>
          <span
            role="tooltip"
            className="pointer-events-none absolute top-full left-0 z-20 mt-1.5 hidden w-60 rounded-xl bg-ink px-3 py-2 text-xs leading-relaxed font-normal text-white shadow-lg group-hover:block group-focus-within:block"
          >
            {TRADABILITY_TIP[row.tradability]}
          </span>
        </span>
      </td>
    </tr>
  );
}

function gapClass(gap: number | null): string {
  if (gap == null || Math.abs(gap) < 0.25) return "text-muted";
  return gap > 0 ? "text-up" : "text-down";
}
