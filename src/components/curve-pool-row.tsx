// One launch pool on a stock-quoted bonding curve: token, what it raised,
// how far it is from graduating. Server-safe (no hooks); used on the stock
// curve page and, in its compact form, inside the stock cards.

import type { CurvePool } from "@/lib/curves";
import { formatUsd } from "@/lib/format";
import { CurvePoolActions } from "./curve-trade";
import { PoolAvatar } from "./pool-avatar";

export type PoolStockInfo = {
  mint: string;
  symbol: string;
  underlying: string;
  price: number | null;
};

const when = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "America/New_York",
});

export function tinyUsd(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "–";
  return v >= 1 ? formatUsd(v) : `$${v.toPrecision(3)}`;
}
export function units(v: number, symbol: string): string {
  const n = v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(2) : v.toFixed(3);
  return `${n} ${symbol}`;
}
export function compactUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return formatUsd(n, 0);
}

/** "2% to graduation", "graduated Sep 12", or "nothing bought yet". */
export function progressWords(p: CurvePool): string {
  if (p.migrated)
    return `graduated${p.finishedAt ? ` ${when.format(new Date(p.finishedAt))}` : ""}`;
  const pct = Math.round(p.progress * 100);
  if (p.progress <= 0) return "nothing bought yet";
  return `${pct < 1 ? "<1" : pct}% of the way to graduation`;
}

function Bar({ p }: { p: CurvePool }) {
  const pct = Math.round(p.progress * 100);
  return (
    <span
      className="block h-1.5 w-full overflow-hidden rounded-full bg-soft"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Progress to graduation"
    >
      <span
        className={`block h-full rounded-full ${p.migrated ? "bg-ink" : "bg-blue"}`}
        style={{ width: `${Math.max(2, pct)}%` }}
      />
    </span>
  );
}

/** Full row for the stock page. */
export function PoolRow({
  p,
  symbol,
  stock,
}: {
  p: CurvePool;
  symbol: string;
  stock?: PoolStockInfo;
}) {
  return (
    <li className="grid grid-cols-[2.5rem_1fr] items-center gap-x-3 gap-y-2 py-3.5 text-sm sm:grid-cols-[2.5rem_minmax(0,1.2fr)_minmax(0,1fr)_auto]">
      <PoolAvatar image={p.image} symbol={p.symbol} name={p.name} size={40} />
      <span className="min-w-0">
        <span className="block truncate font-medium">
          {p.name}
          {p.symbol && (
            <span className="text-muted ml-1.5 text-xs font-normal">
              {p.symbol}
            </span>
          )}
        </span>
        <span className="text-muted num block text-xs">
          {p.migrated
            ? progressWords(p)
            : `${units(p.raisedQuote, symbol)}${p.raisedUsd != null ? ` ≈ ${formatUsd(p.raisedUsd, 0)}` : ""} raised`}
          {p.feesQuote > 0 ? ` · ${units(p.feesQuote, symbol)} in fees` : ""}
        </span>
      </span>
      <span className="col-span-2 sm:col-span-1">
        <Bar p={p} />
        <span className="text-muted num mt-1 block text-xs">
          {p.migrated ? "on an open pool now" : progressWords(p)}
          {!p.migrated && p.priceUsd != null
            ? ` · token at ${tinyUsd(p.priceUsd)}`
            : ""}
        </span>
      </span>
      <span className="col-span-2 flex items-center justify-end gap-3 sm:col-span-1">
        <a
          href={`https://solscan.io/account/${p.pool}`}
          target="_blank"
          rel="noreferrer"
          className="text-muted-2 hover:text-ink text-xs"
        >
          Solscan
        </a>
        {stock && (
          <CurvePoolActions
            pool={p.pool}
            creator={p.creator}
            baseMint={p.baseMint}
            baseName={p.name}
            baseSymbol={p.symbol}
            image={p.image}
            progress={p.progress}
            raisedQuote={p.raisedQuote}
            quoteMint={stock.mint}
            quoteSymbol={stock.symbol}
            underlying={stock.underlying}
            stockPrice={stock.price}
            migrated={p.migrated}
          />
        )}
      </span>
    </li>
  );
}

/** Compact row for the stock card: avatar, name, bar. */
export function PoolMini({ p, symbol }: { p: CurvePool; symbol: string }) {
  return (
    <li className="flex items-center gap-2.5 text-sm">
      <PoolAvatar image={p.image} symbol={p.symbol} name={p.name} size={28} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">{p.name}</span>
        <span className="text-muted num block text-[11px]">
          {p.migrated
            ? "graduated"
            : `${units(p.raisedQuote, symbol)} raised · ${progressWords(p)}`}
        </span>
      </span>
      <span className="w-16 shrink-0">
        <Bar p={p} />
      </span>
    </li>
  );
}
