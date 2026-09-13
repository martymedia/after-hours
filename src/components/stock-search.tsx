"use client";

// Search box in the top bar. Loads the radar once, filters locally.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { RadarRow } from "@/lib/radar-types";
import { gapTone, gapWords } from "@/lib/format";
import { TickerBadge } from "./ticker-badge";

export function StockSearch() {
  const router = useRouter();
  const [rows, setRows] = useState<RadarRow[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/radar", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { rows: RadarRow[] }) => setRows(d.rows))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const needle = q.trim().toLowerCase();
  const hits = needle
    ? rows
        .filter(
          (r) =>
            r.name.toLowerCase().includes(needle) ||
            r.symbol.toLowerCase().includes(needle) ||
            r.underlying.toLowerCase().includes(needle),
        )
        .slice(0, 6)
    : [];

  return (
    <div ref={box} className="relative hidden sm:block">
      <label className="flex h-9 w-56 items-center gap-2 rounded-full border border-line bg-card px-3 text-sm shadow-sm transition focus-within:border-ink lg:w-72">
        <Search size={15} strokeWidth={1.75} className="text-muted" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && hits[0]) {
              router.push(`/stock/${hits[0].underlying}`);
              setOpen(false);
              setQ("");
            }
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Search stocks"
          className="w-full bg-transparent outline-none placeholder:text-muted"
          aria-label="Search stocks"
        />
      </label>
      {open && hits.length > 0 && (
        <ul className="card absolute right-0 z-40 mt-2 w-80 overflow-hidden py-1 shadow-lg">
          {hits.map((r) => (
            <li key={r.underlying}>
              <button
                type="button"
                onClick={() => {
                  router.push(`/stock/${r.underlying}`);
                  setOpen(false);
                  setQ("");
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-soft"
              >
                <TickerBadge symbol={r.symbol} logo={r.logo} size={28} />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-muted ml-2 text-xs">{r.symbol}</span>
                </span>
                <span className={`num text-xs ${gapTone(r.gapPct)}`}>{gapWords(r.gapPct)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
