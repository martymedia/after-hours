"use client";

// The Wallet page: what the connected wallet holds in tokenized stocks, how
// each position has done since it was bought, how the buys compared to Wall
// Street's last print at the time, and the recent swaps with explorer links.

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, CalendarDays, Coins, RefreshCw, Share2, Wallet } from "lucide-react";
import { SellPanel } from "./sell-panel";
import { useConnectedWallet, useDisconnect, useIsWalletReady } from "@solana/kit-plugin-wallet/react";
import { solanaClient } from "@/lib/solana-client";
import { formatPct, formatUsd, gapTone, gapWords } from "@/lib/format";
import type { Activity, Holding, WalletData } from "@/lib/wallet";
import { CountUp } from "./count-up";
import { Sparkline } from "./sparkline";
import { StatCard } from "./stat-card";
import { TickerBadge } from "./ticker-badge";
import { Tip } from "./tip";
import { shortAddress } from "./wallet-connect";

const ConnectButton = dynamic(() => import("./wallet-connect").then((m) => m.ConnectButton), {
  ssr: false,
  loading: () => <span className="btn w-full opacity-50">Checking wallets…</span>,
});

const KIND_LABEL: Record<Activity["kind"], string> = { bought: "Bought", sold: "Sold", received: "Received", sent: "Sent" };
const when = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const clock = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const dayLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const SEGMENT_COLORS = ["#5b91ff", "#8fb3ff", "#3d6fd6", "#c7d6ff", "#2f3340", "#6f7480"];

export function WalletView({ address }: { address?: string }) {
  const ready = useIsWalletReady(solanaClient);
  const connected = useConnectedWallet(solanaClient);
  const { dispatch: disconnect } = useDisconnect(solanaClient);
  const [stored, setStored] = useState<{ owner: string; data: WalletData } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // A public address makes the page read-only: no sell, no disconnect.
  const readOnly = Boolean(address);
  const owner = address ?? connected?.account.address ?? null;
  const [selling, setSelling] = useState<Holding | null>(null);
  const [copied, setCopied] = useState(false);

  const share = async () => {
    if (!owner) return;
    const url = `${window.location.origin}/wallet/${owner}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "My tokenized stocks on After Hours", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  // Keyed by owner so a wallet switch never shows the previous wallet's data.
  const data = stored && stored.owner === owner ? stored.data : null;

  const load = useCallback(async () => {
    if (!owner) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/wallet?owner=${owner}`);
      const body = (await res.json()) as WalletData & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "could not read the wallet");
      setStored({ owner, data: body });
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [owner]);

  useEffect(() => {
    if (!owner) return;
    // Deferred so the effect only schedules work instead of setting state itself.
    const first = setTimeout(load, 0);
    const id = setInterval(load, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [owner, load]);

  if (!ready || (owner && !data && !error)) {
    return (
      <div className="flex flex-col gap-5">
        <div className="card-dark h-64 animate-pulse" />
        <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card h-28 animate-pulse" />
          ))}
        </div>
        <div className="card h-64 animate-pulse" />
      </div>
    );
  }

  if (!owner) {
    return (
      <div className="card-dark relative mx-auto max-w-xl overflow-hidden p-8 text-center sm:p-10">
        <Glow className="-top-24 left-1/2 -translate-x-1/2" />
        <span className="icon-badge relative mx-auto h-12 w-12 border-white/15 bg-white/10 text-white">
          <Wallet size={22} strokeWidth={1.75} />
        </span>
        <h2 className="relative mt-5 text-2xl font-semibold tracking-tight">Your stocks, in your wallet.</h2>
        <p className="text-on-dark-muted relative mx-auto mt-2 max-w-md">
          Connect a wallet to see which tokenized stocks it holds, how each one has done since you bought it, and
          whether you paid less than Wall Street&apos;s last print.
        </p>
        <div className="relative mx-auto mt-6 max-w-xs">
          <ConnectButton className="btn btn-white w-full" />
        </div>
        <p className="text-on-dark-muted relative mt-4 text-xs">Read-only. Nothing is signed until you buy.</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="card p-6">
        <p className="font-medium">Could not read this wallet.</p>
        <p className="text-muted mt-1 text-sm">{error}</p>
        <button type="button" onClick={load} className="btn btn-sm mt-4">
          Try again
        </button>
      </div>
    );
  }

  const d = data!;
  const pnl = d.unrealized;
  const pnlTone = pnl == null ? "text-on-dark-muted" : pnl >= 0 ? "text-up" : "text-down";
  const best = [...d.holdings].filter((h) => h.unrealizedPct != null).sort((a, b) => (b.unrealizedPct ?? 0) - (a.unrealizedPct ?? 0))[0];
  const nextReport = d.holdings
    .filter((h) => h.nextEarnings)
    .sort((a, b) => (a.nextEarnings ?? "").localeCompare(b.nextEarnings ?? ""))[0];

  return (
    <div className="t-reveal flex flex-col gap-6">
      {/* Address row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="icon-badge h-10 w-10 bg-ink text-white border-ink">
            <Wallet size={18} strokeWidth={1.75} />
          </span>
          <div>
            <p className="num font-medium">
              {shortAddress(owner)}
              {readOnly && <span className="text-muted ml-2 text-xs font-normal">read-only view</span>}
            </p>
            <p className="text-muted text-xs">
              Updated {clock.format(new Date(d.generatedAt))}
              {loading ? " · refreshing" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={load} disabled={loading} className="icon-badge h-9 w-9 hover:bg-soft" aria-label="Refresh">
            <RefreshCw size={15} strokeWidth={1.75} className={loading ? "animate-spin" : ""} />
          </button>
          <a href={`https://solscan.io/account/${owner}`} target="_blank" rel="noreferrer" className="btn btn-sm border border-line bg-card text-ink hover:bg-soft">
            Solscan
          </a>
          {!readOnly && (
            <button type="button" onClick={share} className="btn btn-sm border border-line bg-card text-ink hover:bg-soft" aria-label="Share this wallet">
              <Share2 size={14} strokeWidth={1.75} className="mr-1.5" />
              {copied ? "Link copied" : "Share"}
            </button>
          )}
          {!readOnly && (
            <button type="button" onClick={() => disconnect()} className="btn btn-sm border border-line bg-card text-ink hover:bg-soft">
              Disconnect
            </button>
          )}
        </div>
      </div>

      {/* Hero: value, P&L, allocation */}
      <section className="card-dark rise relative overflow-hidden p-6 sm:p-8" style={{ "--i": 0 } as React.CSSProperties}>
        <Glow className="-top-32 -left-24" />
        <Glow className="-right-24 -bottom-40 opacity-60" />
        <div className="relative grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p className="text-on-dark-muted flex items-center gap-2 text-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue" />
              </span>
              Your stocks, priced live onchain
            </p>
            <p className="num mt-2 text-5xl font-semibold tracking-tight sm:text-6xl">
              <CountUp value={d.totalValue} kind="usd" />
            </p>
            <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <div>
                <p className="text-on-dark-muted text-xs">Since you bought</p>
                <p className={`num text-xl font-semibold ${pnlTone}`}>
                  {pnl == null ? "–" : `${signed(pnl)} · ${formatPct(d.unrealizedPct)}`}
                </p>
              </div>
              <div>
                <p className="text-on-dark-muted text-xs">Last 24 hours</p>
                <p className={`num text-xl font-semibold ${d.change24h == null ? "text-on-dark-muted" : d.change24h >= 0 ? "text-up" : "text-down"}`}>
                  {d.change24h == null ? "–" : `${signed(d.change24h)} · ${formatPct(d.change24hPct)}`}
                </p>
              </div>
              {d.realized !== 0 && (
                <div>
                  <p className="text-on-dark-muted text-xs">Realized</p>
                  <p className={`num text-xl font-semibold ${d.realized >= 0 ? "text-up" : "text-down"}`}>{signed(d.realized)}</p>
                </div>
              )}
            </div>
            {d.edgeUsd != null && d.edgeBuys > 0 && (
              <p className="mt-5 text-sm leading-relaxed">
                <span className={`font-medium ${d.edgeUsd >= 0 ? "text-blue-light" : "text-down"}`}>
                  {d.edgeUsd >= 0 ? "After Hours edge: " : "After Hours cost: "}
                  {formatUsd(Math.abs(d.edgeUsd))}
                </span>{" "}
                <span className="text-on-dark-muted">
                  {d.edgeUsd >= 0 ? "less" : "more"} than Wall Street&apos;s last print across {d.edgeBuys} {d.edgeBuys === 1 ? "buy" : "buys"}.{" "}
                  <Tip text="For every buy we compare what you paid per share with the reference price at that moment. Buying while the exchange is closed is where this adds up." tone="light" underline>
                    How is that counted?
                  </Tip>
                </span>
              </p>
            )}
            {d.partialBasis && (
              <p className="text-on-dark-muted mt-2 text-xs">
                Some units were bought before the last 50 transactions; their cost is unknown and left out of the gain.
              </p>
            )}
          </div>

          {/* Allocation */}
          <div className="lg:col-span-5">
            <p className="text-on-dark-muted text-sm">Allocation</p>
            {d.holdings.length === 0 ? (
              <p className="text-on-dark-muted mt-2 text-sm">Nothing yet.</p>
            ) : (
              <>
                <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-white/10">
                  {d.holdings.map((h, i) => (
                    <span
                      key={h.mint}
                      className="h-full transition-[width] duration-700"
                      style={{ width: `${Math.max(1.5, h.share * 100)}%`, background: SEGMENT_COLORS[i % SEGMENT_COLORS.length], boxShadow: i === 0 ? "0 0 16px rgba(91,145,255,0.7)" : undefined }}
                      title={`${h.name} ${(h.share * 100).toFixed(0)}%`}
                    />
                  ))}
                </div>
                <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  {d.holdings.slice(0, 6).map((h, i) => (
                    <li key={h.mint} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }} />
                      <span className="truncate">{h.name}</span>
                      <span className="num text-on-dark-muted ml-auto">{(h.share * 100).toFixed(0)}%</span>
                    </li>
                  ))}
                </ul>
                {d.holdings.length > 1 && d.holdings[0].share > 0.6 && (
                  <p className="text-on-dark-muted mt-3 text-xs">
                    {d.holdings[0].name} is {(d.holdings[0].share * 100).toFixed(0)}% of the book. One report can move the whole number.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
        <StatCard
          index={1}
          icon={Coins}
          label="Ready to buy"
          value={<CountUp value={d.usdc} kind="usd" />}
          detail="USDC in this wallet"
          hint="Buys are paid in USDC. SOL only pays the network fee."
        />
        <StatCard
          index={2}
          icon={Coins}
          label="SOL for fees"
          value={<span className="num">{d.sol.toFixed(4)}</span>}
          detail={d.sol < 0.005 ? "Low. Add about 0.02 SOL." : `${formatSol(d.feesSol)} SOL spent on fees so far`}
          badge={d.sol < 0.005 ? <span className="pill bg-soft-warn text-warn">low</span> : undefined}
          hint="Each transaction costs a fraction of a cent in SOL, and the first buy of a stock reserves about 0.002 SOL for its token account."
        />
        <StatCard
          index={3}
          icon={ArrowUpRight}
          label="Best position"
          href={best ? `/stock/${best.underlying}` : undefined}
          value={best ? best.name : "–"}
          detail={best ? <span className={(best.unrealizedPct ?? 0) >= 0 ? "text-up" : "text-down"}>{formatPct(best.unrealizedPct)} since you bought</span> : "No traced buys yet"}
          hint="The position with the highest gain against its average buy price."
        />
        <StatCard
          index={4}
          icon={CalendarDays}
          label="Next report"
          href={nextReport ? `/stock/${nextReport.underlying}` : "/earnings"}
          value={nextReport ? nextReport.name : "–"}
          detail={nextReport && nextReport.nextEarnings ? `Earnings ${dayLabel.format(new Date(`${nextReport.nextEarnings}T12:00:00Z`))}` : "No earnings ahead in your holdings"}
          hint="Earnings land after the bell and the onchain price reacts first. This is your soonest one."
        />
      </div>

      {selling && (
        <SellPanel
          mint={selling.mint}
          symbol={selling.symbol}
          name={selling.name}
          logo={selling.logo}
          held={selling.amount}
          referencePhrase={d.referencePhrase}
          onClose={() => setSelling(null)}
          onSold={() => setTimeout(load, 1500)}
        />
      )}

      <div className="grid gap-5 lg:grid-cols-12">
        {/* Holdings */}
        <section className="card p-5 lg:col-span-7">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-semibold">Holdings</h2>
            <span className="text-muted text-xs">value · gain since buy</span>
          </div>
          {d.holdings.length === 0 ? (
            <div className="py-8 text-center">
              <p className="font-medium">No tokenized stocks yet.</p>
              <p className="text-muted mt-1 text-sm">Pick one and buy from this wallet. It shows up here right after the transaction confirms.</p>
              <Link href="/stocks" className="btn btn-sm mt-4">
                See what is trading
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {d.holdings.map((h) => (
                <HoldingRow key={h.mint} h={h} onSell={readOnly ? undefined : () => setSelling(h)} />
              ))}
            </ul>
          )}
        </section>

        {/* Activity */}
        <section className="card p-5 lg:col-span-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-semibold">Recent activity</h2>
            <span className="text-muted text-xs">last 50 transactions scanned</span>
          </div>
          {d.activity.length === 0 ? (
            <p className="text-muted py-8 text-center text-sm">No stock trades in the recent history of this wallet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {d.activity.map((a) => (
                <li key={`${a.signature}-${a.mint}`}>
                  <a href={`https://solscan.io/tx/${a.signature}`} target="_blank" rel="noreferrer" className="group flex items-center gap-3 py-3 transition hover:opacity-80">
                    <TickerBadge symbol={a.symbol} logo={a.logo} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        <span className={a.kind === "bought" || a.kind === "received" ? "text-blue" : "text-ink"}>{KIND_LABEL[a.kind]}</span>{" "}
                        {trimAmount(a.amount)} {a.symbol}
                        {a.usd != null && <span className="text-muted font-normal"> for {formatUsd(a.usd)}</span>}
                      </span>
                      <span className="text-muted num block text-xs">
                        {when.format(new Date(a.ts))}
                        {a.vsRefPct != null && a.kind === "bought" && (
                          <>
                            {" · "}
                            <span className={gapTone(a.vsRefPct)}>{gapWords(a.vsRefPct)} than Wall Street</span>
                          </>
                        )}
                      </span>
                    </span>
                    <span className="text-muted-2 group-hover:text-ink transition" aria-hidden="true">
                      <ArrowUpRight size={16} strokeWidth={1.75} />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p className="text-muted mt-3 text-xs">Every row opens the transaction on Solscan. This is your wallet read live; nothing is stored or custodied by us.</p>
        </section>
      </div>
    </div>
  );
}

function HoldingRow({ h, onSell }: { h: Holding; onSell?: () => void }) {
  const tone = h.unrealized == null ? "text-muted" : h.unrealized >= 0 ? "text-up" : "text-down";
  return (
    <li className="flex items-center gap-2">
      <Link href={`/stock/${h.underlying}`} className="flex min-w-0 flex-1 items-center gap-3 py-3 transition hover:opacity-80">
        <TickerBadge symbol={h.symbol} logo={h.logo} size={40} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{h.name}</span>
          <span className="text-muted num block text-xs">
            {trimAmount(h.amount)} {h.symbol}
            {h.avgCost != null ? ` · avg ${formatUsd(h.avgCost)}` : ""}
            {h.basisUnits < h.amount - 1e-9 ? " · partly untraced" : ""}
          </span>
        </span>
        <span className="hidden sm:block">
          <Sparkline values={h.spark} color={(h.change24hPct ?? 0) >= 0 ? "var(--blue)" : "var(--down)"} />
        </span>
        <span className="w-28 shrink-0 text-right">
          <span className="num block font-semibold">{h.value == null ? "–" : formatUsd(h.value)}</span>
          <span className={`num block text-xs ${tone}`}>
            {h.unrealized == null ? <span className={gapTone(h.gapPct)}>{gapWords(h.gapPct)}</span> : `${signed(h.unrealized)} · ${formatPct(h.unrealizedPct)}`}
          </span>
        </span>
      </Link>
      {onSell && (
        <button type="button" onClick={onSell} className="pill shrink-0 border border-line bg-card text-ink hover:border-ink" aria-label={`Sell ${h.symbol}`}>
          Sell
        </button>
      )}
    </li>
  );
}

/** Soft blue light behind the dark hero. A blurred disc, not a gradient. */
function Glow({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`pointer-events-none absolute h-72 w-72 rounded-full bg-blue/30 blur-3xl ${className}`} />;
}

function signed(n: number): string {
  return `${n >= 0 ? "+" : "−"}${formatUsd(Math.abs(n))}`;
}

function formatSol(n: number): string {
  return n < 0.001 ? n.toFixed(6) : n.toFixed(4);
}

function trimAmount(n: number): string {
  if (n >= 100) return n.toFixed(2);
  if (n >= 1) return n.toFixed(3);
  return n.toFixed(4);
}
