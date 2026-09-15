"use client";

// Wallet page: the curves this wallet launched, each drawn as its own
// curve with a marker where the buyers have got to. Addresses to copy and
// the trading fees waiting to be claimed sit on the same tile.

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import type { CreatorCurve } from "@/lib/curve-trade";
import { formatUsd } from "@/lib/format";
import { ClaimFeesButton } from "./curve-trade";
import { CopyField } from "./copy-field";
import { CurveShape } from "./curve-shape";
import { PoolAvatar } from "./pool-avatar";

function fmt(n: number): string {
  if (n === 0) return "0";
  return n >= 1 ? n.toFixed(4) : Number(n.toPrecision(4)).toString();
}

export function YourCurves({ owner }: { owner: string }) {
  const [curves, setCurves] = useState<CreatorCurve[] | null>(null);
  const [partner, setPartner] = useState<CreatorCurve[]>([]);
  const [claimed, setClaimed] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/curves/creator?owner=${owner}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (b: { pools?: CreatorCurve[]; partner?: CreatorCurve[] } | null) => {
          if (cancelled || !b) return;
          if (b.pools) setCurves(b.pools);
          if (b.partner) setPartner(b.partner);
        },
      )
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [owner]);
  const platform = (
    <PlatformFees
      curves={partner}
      claimed={claimed}
      onClaimed={(pool) => setClaimed((s) => [...s, pool])}
    />
  );
  if (!curves || curves.length === 0) return platform;
  const waiting = curves.filter(
    (c) => c.quoteFee > 0 && !claimed.includes(c.pool),
  );
  const usd = waiting.reduce((a, c) => a + (c.usd ?? 0), 0);
  return (
    <>
      {platform}
      <section className="rise card p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Your curves
            </h2>
            <p className="text-muted text-sm">
              {waiting.length > 0 ? (
                <>
                  <span className="text-up font-medium">
                    {usd > 0 ? formatUsd(usd) : "Trading fees"} waiting for you.
                  </span>{" "}
                  Claiming sends them to this wallet.
                </>
              ) : (
                `${curves.length === 1 ? "One token" : `${curves.length} tokens`} launched from this wallet. Trading fees land here as people buy.`
              )}
            </p>
          </div>
          <Link href="/curves/build" className="btn btn-sm">
            Build another
          </Link>
        </div>

        <ul className="mt-4 grid gap-3 xl:grid-cols-2">
          {curves.map((c) => {
            const pct = Math.round(c.progress * 100);
            const open = c.quoteFee > 0 && !claimed.includes(c.pool);
            return (
              <li
                key={c.pool}
                className="relative overflow-hidden rounded-2xl bg-ink p-4 text-white"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-blue/25 blur-3xl"
                />
                <div className="relative flex items-center gap-3">
                  <PoolAvatar
                    image={c.image}
                    symbol={c.symbol}
                    name={c.name}
                    size={38}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{c.name}</div>
                    <div className="text-on-dark-muted truncate text-xs">
                      {c.symbol ? `${c.symbol} · ` : ""}priced in{" "}
                      {c.quoteSymbol}
                    </div>
                  </div>
                  <Link
                    href={`/curves/${c.underlying}`}
                    className="icon-badge h-8 w-8 shrink-0 border-white/20 bg-transparent text-white hover:bg-white/10"
                    aria-label={`${c.quoteSymbol} curves`}
                  >
                    <ArrowUpRight size={15} strokeWidth={1.75} />
                  </Link>
                </div>

                {/* The curve itself, with a marker where the buyers stand */}
                <div className="relative mt-3 text-white/60">
                  <CurveShape
                    startLabel="start"
                    endLabel="graduation"
                    raiseLabel={
                      c.migrated
                        ? "graduated to an open pool"
                        : `${fmt(c.raisedQuote)} ${c.quoteSymbol} raised${c.raisedUsd != null ? ` ≈ ${formatUsd(c.raisedUsd, 0)}` : ""}`
                    }
                    ratio={c.ratio}
                    fill="#8fb3ff"
                    progress={c.progress}
                  />
                </div>

                <div className="num relative mt-1 grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-on-dark-muted text-xs">
                      {c.migrated ? "Final" : "To graduation"}
                    </div>
                    <div className="text-xl leading-tight font-semibold">
                      {c.migrated ? "100%" : `${pct < 1 ? "<1" : pct}%`}
                    </div>
                  </div>
                  <div>
                    <div className="text-on-dark-muted text-xs">Your fees</div>
                    <div className="text-xl leading-tight font-semibold">
                      {c.quoteFee > 0
                        ? c.usd != null
                          ? formatUsd(c.usd)
                          : `${fmt(c.quoteFee)} ${c.quoteSymbol}`
                        : "–"}
                    </div>
                  </div>
                </div>

                {open && (
                  <ClaimFeesButton
                    pool={c.pool}
                    label={`Claim ${fmt(c.quoteFee)} ${c.quoteSymbol}`}
                    className="btn btn-white btn-sm relative mt-3 w-full"
                    onDone={() => setClaimed((s) => [...s, c.pool])}
                  />
                )}

                <details className="relative mt-3">
                  <summary className="text-on-dark-muted cursor-pointer text-xs hover:text-white">
                    Addresses
                  </summary>
                  <div className="mt-2 grid gap-2">
                    <CopyField label="Pool" value={c.pool} dark />
                    <CopyField label="Token mint" value={c.baseMint} dark />
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

/** Our own share of the trading fees, claimable by the wallet the curves name as fee claimer. */
function PlatformFees({
  curves,
  claimed,
  onClaimed,
}: {
  curves: CreatorCurve[];
  claimed: string[];
  onClaimed: (pool: string) => void;
}) {
  const open = curves.filter(
    (c) => c.quoteFee > 0 && !claimed.includes(c.pool),
  );
  if (open.length === 0) return null;
  const usd = open.reduce((a, c) => a + (c.usd ?? 0), 0);
  return (
    <section className="rise card p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Platform fees
          </h2>
          <p className="text-muted text-sm">
            The 10% share of the trading fees on curves built through After
            Hours. This wallet is their fee claimer.
          </p>
        </div>
        {usd > 0 && (
          <span className="num text-up text-lg font-semibold">
            {formatUsd(usd)}
          </span>
        )}
      </div>
      <ul className="mt-3 divide-y divide-line">
        {open.map((c) => (
          <li key={c.pool} className="flex items-center gap-3 py-3 text-sm">
            <PoolAvatar
              image={c.image}
              symbol={c.symbol}
              name={c.name}
              size={32}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{c.name}</span>
              <span className="text-muted num block text-xs">
                {fmt(c.quoteFee)} {c.quoteSymbol}
                {c.usd != null ? ` ≈ ${formatUsd(c.usd)}` : ""}
                {c.baseFee > 0 ? ` · plus ${fmt(c.baseFee)} of the token` : ""}
              </span>
            </span>
            <ClaimFeesButton
              pool={c.pool}
              role="partner"
              label={`Claim ${fmt(c.quoteFee)} ${c.quoteSymbol}`}
              className="btn btn-sm"
              onDone={() => onClaimed(c.pool)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
