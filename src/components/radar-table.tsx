"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { RadarData, RadarRow, Tradability } from "@/lib/radar-types";
import { TRADABILITY_LABEL } from "@/lib/radar-types";
import { formatAgo, formatDuration, formatPct, formatUsd, gapTone, gapWords } from "@/lib/format";
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

type Issuer = "all" | "xstocks" | "backpack";
type Sort = "liquidity" | "move" | "cheaper" | "name";
type Show = "all" | "easy" | "moved";

const SORTS: { id: Sort; label: string }[] = [
  { id: "liquidity", label: "Most liquid" },
  { id: "move", label: "Biggest move" },
  { id: "cheaper", label: "Cheapest vs close" },
  { id: "name", label: "A to Z" },
];

const SHOWS: { id: Show; label: string }[] = [
  { id: "all", label: "All" },
  { id: "easy", label: "Easy to trade" },
  { id: "moved", label: "Moved 1%+" },
];

export function RadarTable({ initial }: { initial: RadarData }) {
  const [data, setData] = useState(initial);
  const [now, setNow] = useState(() => Date.parse(initial.generatedAt));
  const [issuer, setIssuer] = useState<Issuer>("all");
  const [sort, setSort] = useState<Sort>("cheaper");
  const inputRef = useRef<HTMLInputElement>(null);
  const [show, setShow] = useState<Show>("all");
  const [q, setQ] = useState("");

  // The magnifier in the top bar links here with #find: put the cursor in the box.
  useEffect(() => {
    if (window.location.hash === "#find") inputRef.current?.focus();
  }, []);

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

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = data.rows.filter((r) => {
      if (issuer !== "all" && r.issuer !== issuer) return false;
      if (show === "easy" && r.tradability !== "easy") return false;
      if (show === "moved" && Math.abs(r.gapPct ?? 0) < 1) return false;
      if (needle && !(r.name.toLowerCase().includes(needle) || r.symbol.toLowerCase().includes(needle) || r.underlying.toLowerCase().includes(needle))) return false;
      return true;
    });
    const by: Record<Sort, (a: RadarRow, b: RadarRow) => number> = {
      liquidity: (a, b) => b.liquidity - a.liquidity,
      move: (a, b) => Math.abs(b.gapPct ?? 0) - Math.abs(a.gapPct ?? 0),
      cheaper: (a, b) => (a.gapPct ?? 0) - (b.gapPct ?? 0),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return [...list].sort(by[sort]);
  }, [data.rows, issuer, show, sort, q]);

  return (
    <div className="flex flex-col gap-5">
      <section className="card p-5">
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

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex h-9 items-center gap-2 rounded-full bg-soft px-3 text-sm">
            <Search size={15} strokeWidth={1.75} className="text-muted" />
            <input
              ref={inputRef}
              id="find"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter by name or ticker"
              className="w-40 bg-transparent outline-none placeholder:text-muted sm:w-52"
              aria-label="Filter stocks"
            />
          </label>
          <div className="seg" role="group" aria-label="Issuer">
            {(["all", "xstocks", "backpack"] as Issuer[]).map((f) => (
              <button key={f} type="button" aria-pressed={issuer === f} onClick={() => setIssuer(f)}>
                {f === "all" ? "All issuers" : f === "xstocks" ? "xStocks" : "Backpack"}
              </button>
            ))}
          </div>
          <div className="seg" role="group" aria-label="Show">
            {SHOWS.map((s) => (
              <button key={s.id} type="button" aria-pressed={show === s.id} onClick={() => setShow(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
          <label className="text-muted flex items-center gap-2 text-sm">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="text-ink h-9 rounded-full bg-soft px-3 text-sm font-medium outline-none"
              aria-label="Sort"
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* While typing, the best matches sit right under the box, above the keyboard. */}
        {q.trim() && rows.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {rows.slice(0, 5).map((r) => (
              <Link key={r.underlying} href={`/stock/${r.underlying}`} className="card flex items-center gap-2 py-1.5 pr-3 pl-1.5 text-sm transition hover:border-muted-2">
                <TickerBadge symbol={r.symbol} logo={r.logo} size={24} />
                <span className="font-medium">{r.name}</span>
                <span className={`num text-xs ${gapTone(r.gapPct)}`}>{gapWords(r.gapPct)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Phones: one compact row per stock, no sideways scrolling. */}
      <section className="card divide-y divide-line md:hidden">
        {rows.map((row) => {
          const ageMs = row.ageMs == null ? null : row.ageMs + (now - Date.parse(data.generatedAt));
          return (
            <Link key={row.underlying} href={`/stock/${row.underlying}`} className="flex items-center gap-3 px-4 py-3 active:bg-soft">
              <TickerBadge symbol={row.symbol} logo={row.logo} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{row.name}</span>
                <span className="text-muted block truncate text-xs">
                  {row.symbol} · {row.issuerName} · {ageMs == null ? "–" : formatAgo(Math.max(0, ageMs))}
                </span>
              </span>
              <span className="text-right">
                <span className="num block text-sm font-semibold">{formatUsd(row.price)}</span>
                <span className={`num block text-xs ${gapTone(row.gapPct)}`}>{gapWords(row.gapPct)}</span>
              </span>
            </Link>
          );
        })}
        {rows.length === 0 && <p className="text-muted px-4 py-8 text-center text-sm">Nothing matches. Loosen a filter.</p>}
      </section>

      <section className="card hidden overflow-hidden md:block">
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
                  <Tip text={`Onchain price versus ${ref.phrase}. Blue and negative: cheaper onchain than on Wall Street. Red and positive: pricier. Within a quarter percent counts as in line.`}>
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
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-muted px-5 py-8 text-center text-sm">
                    Nothing matches. Loosen a filter.
                  </td>
                </tr>
              )}
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
          <TickerBadge symbol={row.symbol} logo={row.logo} size={32} />
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
      <td className={`num px-4 py-3 text-right font-medium ${gapTone(row.gapPct)}`}>{formatPct(row.gapPct)}</td>
      <td className="hidden px-4 py-3 md:table-cell">
        <Sparkline values={row.spark} color="var(--blue)" />
      </td>
      <td className="num text-muted px-4 py-3 text-right text-xs">{ageMs == null ? "–" : formatAgo(Math.max(0, ageMs))}</td>
      <td className="px-4 py-3 pr-5">
        <Tip text={TRADABILITY_TIP[row.tradability]} underline={false}>
          <span className={`pill ${PILL[row.tradability]}`}>{TRADABILITY_LABEL[row.tradability]}</span>
        </Tip>
      </td>
    </tr>
  );
}

