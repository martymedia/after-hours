// One launch pool on a stock-quoted bonding curve: token, what it raised,
// how far it is from graduating. Server-safe (no hooks); used on the stock
// curve page and, in its compact form, inside the stock cards.

import type { CurvePool } from "@/lib/curves";
import { formatUsd } from "@/lib/format";
import { CurvePoolActions } from "./curve-trade";

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

export function PoolAvatar({ p, size = 32 }: { p: CurvePool; size?: number }) {
  const initials = (p.symbol ?? (p.name.startsWith("(") ? "?" : p.name))
    .slice(0, 2)
    .toUpperCase();
  return p.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={p.image}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full bg-soft object-cover"
      style={{ width: size, height: size }}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  ) : (
    <span
      className="icon-badge shrink-0 text-[10px] font-semibold"
      style={{ width: size, height: size }}
    >
      {initials}
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
  const pct = Math.round(p.progress * 100);
  return (
    <li className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 py-3 text-sm sm:grid-cols-[2.25rem_minmax(0,1.3fr)_minmax(0,1fr)_auto]">
      <PoolAvatar p={p} size={36} />
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
            ? `graduated${p.finishedAt ? ` ${when.format(new Date(p.finishedAt))}` : ""}`
            : `${units(p.raisedQuote, symbol)}${p.raisedUsd != null ? ` ≈ ${formatUsd(p.raisedUsd, 0)}` : ""} raised`}
          {p.feesQuote > 0 ? ` · ${units(p.feesQuote, symbol)} in fees` : ""}
        </span>
      </span>
      <span className="col-span-3 sm:col-span-1">
        <span className="flex items-center gap-2">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-soft">
            <span
              className={`block h-full rounded-full ${p.migrated ? "bg-ink" : "bg-blue"}`}
              style={{ width: `${Math.max(1, pct)}%` }}
            />
          </span>
          <span className="num w-9 text-right text-xs">{pct}%</span>
        </span>
        {!p.migrated && (
          <span className="text-muted num block text-xs">
            token at {tinyUsd(p.priceUsd)}
          </span>
        )}
      </span>
      <span className="flex items-center gap-2">
        {stock && (
          <CurvePoolActions
            pool={p.pool}
            creator={p.creator}
            baseMint={p.baseMint}
            baseName={p.name}
            baseSymbol={p.symbol}
            quoteMint={stock.mint}
            quoteSymbol={stock.symbol}
            underlying={stock.underlying}
            stockPrice={stock.price}
            migrated={p.migrated}
          />
        )}
        <a
          href={`https://solscan.io/account/${p.pool}`}
          target="_blank"
          rel="noreferrer"
          className="text-muted-2 hover:text-ink text-xs"
        >
          Solscan
        </a>
      </span>
    </li>
  );
}

/** Compact row for the stock card: avatar, name, bar. */
export function PoolMini({ p, symbol }: { p: CurvePool; symbol: string }) {
  const pct = Math.round(p.progress * 100);
  return (
    <li className="flex items-center gap-2.5 text-sm">
      <PoolAvatar p={p} size={26} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">{p.name}</span>
        <span className="text-muted num block text-[11px]">
          {p.migrated ? "graduated" : `${units(p.raisedQuote, symbol)} raised`}
        </span>
      </span>
      <span className="flex w-24 items-center gap-1.5">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-soft">
          <span
            className={`block h-full rounded-full ${p.migrated ? "bg-ink" : "bg-blue"}`}
            style={{ width: `${Math.max(2, pct)}%` }}
          />
        </span>
        <span className="num w-8 text-right text-[11px]">{pct}%</span>
      </span>
    </li>
  );
}
