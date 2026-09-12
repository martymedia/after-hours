"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { RadarData, RadarRow, Tradability } from "@/lib/radar-types";
import { TRADABILITY_LABEL } from "@/lib/radar-types";
import { formatAgo, formatPct, formatUsd } from "@/lib/format";
import { Sparkline } from "./sparkline";
import { StatusLine } from "./status-line";

const REFRESH_MS = 15_000;

const TRADABILITY_STYLE: Record<Tradability, string> = {
  easy: "bg-soft-up text-up",
  ok: "bg-soft text-ink",
  thin: "bg-soft-warn text-warn",
  stale: "bg-soft-warn text-warn",
  none: "bg-soft text-muted",
};

function gapClass(gap: number | null): string {
  if (gap == null) return "text-muted";
  if (Math.abs(gap) < 0.25) return "text-muted";
  return gap > 0 ? "text-up" : "text-down";
}

export function RadarTable({ initial }: { initial: RadarData }) {
  const [data, setData] = useState(initial);
  const [now, setNow] = useState(() => Date.parse(initial.generatedAt));

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

  const referenceLabel = data.reference.short;

  return (
    <>
      <StatusLine phase={data.phase} stockCount={data.rows.length} now={now} />

      {data.earnings.length > 0 && (
        <p className="text-muted mb-4 text-sm">
          <span className="text-ink font-medium">Earnings ahead:</span>{" "}
          {data.earnings.map((e, i) => (
            <span key={`${e.underlying}-${e.date}`}>
              {i > 0 ? " · " : ""}
              <Link href={`/stock/${e.underlying}`} className="hover:underline">
                {e.name}
              </Link>{" "}
              {formatEarningsDate(e.date)}
              {e.timing !== "unknown" ? `, ${e.timing}` : ""}
            </span>
          ))}
          . Reports land after the bell; onchain prices react first.
        </p>
      )}

      <div className="border-line overflow-x-auto rounded-lg border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted border-line border-b text-left text-xs">
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 text-right font-medium">Onchain price</th>
              <th className="px-4 py-3 text-right font-medium">{referenceLabel}</th>
              <th className="px-4 py-3 text-right font-medium">Difference</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Last 48h</th>
              <th className="px-4 py-3 text-right font-medium">Updated</th>
              <th className="px-4 py-3 font-medium">Tradability</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <Row key={row.underlying} row={row} elapsedMs={now - Date.parse(data.generatedAt)} />
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-muted mt-4 text-xs leading-relaxed">
        Onchain price is the last trade on Solana for the most liquid token of each stock.{" "}
        {data.liveReference
          ? "Wall Street is the live reference price from the exchange or the overnight venue."
          : `${data.reference.short} is the last regular-session price; the difference shows how far the onchain market has moved since.`}{" "}
        Nothing here is investment advice.
      </p>
    </>
  );
}

const earningsDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function formatEarningsDate(ymd: string): string {
  return earningsDate.format(new Date(`${ymd}T12:00:00Z`));
}

function Row({ row, elapsedMs }: { row: RadarRow; elapsedMs: number }) {
  const ageMs = row.ageMs == null ? null : row.ageMs + elapsedMs;
  return (
    <tr className="border-line border-b last:border-b-0">
      <td className="px-4 py-3">
        <Link href={`/stock/${row.underlying}`} className="group flex flex-col">
          <span className="font-medium group-hover:underline">{row.name}</span>
          <span className="text-muted text-xs">
            {row.symbol} · {row.issuerName}
            {row.issuerCount > 1 ? ` · +${row.issuerCount - 1} more` : ""}
          </span>
        </Link>
      </td>
      <td className="num px-4 py-3 text-right">{formatUsd(row.price)}</td>
      <td className="num text-muted px-4 py-3 text-right">{formatUsd(row.reference)}</td>
      <td className={`num px-4 py-3 text-right font-medium ${gapClass(row.gapPct)}`}>
        {formatPct(row.gapPct)}
      </td>
      <td className="hidden px-4 py-3 sm:table-cell">
        <Sparkline values={row.spark} />
      </td>
      <td className="num text-muted px-4 py-3 text-right text-xs">
        {ageMs == null ? "–" : formatAgo(Math.max(0, ageMs))}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TRADABILITY_STYLE[row.tradability]}`}
        >
          {TRADABILITY_LABEL[row.tradability]}
        </span>
      </td>
    </tr>
  );
}
