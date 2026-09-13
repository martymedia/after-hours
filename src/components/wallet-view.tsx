"use client";

// The Wallet page: what the connected wallet holds in tokenized stocks, what
// that is worth against the last reference price, and its recent swaps with
// links to the explorer.

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, Coins, Layers, RefreshCw, Wallet } from "lucide-react";
import { useConnectedWallet, useDisconnect, useIsWalletReady } from "@solana/kit-plugin-wallet/react";
import { solanaClient } from "@/lib/solana-client";
import { formatUsd, gapTone, gapWords } from "@/lib/format";
import type { Activity, WalletData } from "@/lib/wallet";
import { CountUp } from "./count-up";
import { StatCard } from "./stat-card";
import { TickerBadge } from "./ticker-badge";
import { shortAddress } from "./wallet-connect";

const ConnectButton = dynamic(() => import("./wallet-connect").then((m) => m.ConnectButton), {
  ssr: false,
  loading: () => <span className="btn w-full opacity-50">Checking wallets…</span>,
});

const KIND_LABEL: Record<Activity["kind"], string> = { bought: "Bought", sold: "Sold", received: "Received", sent: "Sent" };
const when = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const clock = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

export function WalletView() {
  const ready = useIsWalletReady(solanaClient);
  const connected = useConnectedWallet(solanaClient);
  const { dispatch: disconnect } = useDisconnect(solanaClient);
  const [stored, setStored] = useState<{ owner: string; data: WalletData } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const owner = connected?.account.address ?? null;
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
      <div className="card-dark mx-auto max-w-xl p-8 text-center sm:p-10">
        <span className="icon-badge mx-auto h-12 w-12 border-white/15 bg-white/10 text-white">
          <Wallet size={22} strokeWidth={1.75} />
        </span>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight">Your stocks, in your wallet.</h2>
        <p className="text-on-dark-muted mx-auto mt-2 max-w-md">
          Connect a wallet to see which tokenized stocks it holds, what they are worth against the last Wall Street
          price, and every buy and sell with a link to the explorer.
        </p>
        <div className="mx-auto mt-6 max-w-xs">
          <ConnectButton className="btn btn-white w-full" />
        </div>
        <p className="text-on-dark-muted mt-4 text-xs">Read-only. Nothing is signed until you buy.</p>
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
  const cheaperCount = d.holdings.filter((h) => (h.gapPct ?? 0) < -0.25).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Address row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="icon-badge h-10 w-10 bg-ink text-white border-ink">
            <Wallet size={18} strokeWidth={1.75} />
          </span>
          <div>
            <p className="num font-medium">{shortAddress(owner)}</p>
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
          <button type="button" onClick={() => disconnect()} className="btn btn-sm border border-line bg-card text-ink hover:bg-soft">
            Disconnect
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
        <StatCard
          index={0}
          icon={Layers}
          label="Stocks value"
          value={<CountUp value={d.totalValue} kind="usd" />}
          detail={`${d.holdings.length} ${d.holdings.length === 1 ? "position" : "positions"} at onchain prices`}
          hint="Your tokenized stocks priced at the latest onchain trade. Not what a broker would show; it moves 24/7."
        />
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
          detail={d.sol < 0.005 ? "Low. Add about 0.02 SOL." : "Enough for many trades"}
          badge={d.sol < 0.005 ? <span className="pill bg-soft-warn text-warn">low</span> : undefined}
          hint="Each transaction costs a fraction of a cent in SOL, and the first buy of a stock reserves about 0.002 SOL for its token account."
        />
        <StatCard
          index={3}
          icon={ArrowUpRight}
          label="Below reference"
          value={<CountUp value={cheaperCount} kind="int" />}
          detail={`of ${d.holdings.length} trade cheaper onchain right now`}
          hint="Positions whose onchain price is under the last Wall Street print. A cheap onchain price is good for buying more, not for selling."
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        {/* Holdings */}
        <section className="card p-5 lg:col-span-7">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-semibold">Holdings</h2>
            <span className="text-muted text-xs">onchain price · vs reference</span>
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
                <li key={h.mint}>
                  <Link href={`/stock/${h.underlying}`} className="flex items-center gap-3 py-3 transition hover:opacity-80">
                    <TickerBadge symbol={h.symbol} logo={h.logo} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{h.name}</span>
                      <span className="text-muted num block text-xs">
                        {trimAmount(h.amount)} {h.symbol} · {h.issuerName}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="num block font-semibold">{h.value == null ? "–" : formatUsd(h.value)}</span>
                      <span className={`num block text-xs ${gapTone(h.gapPct)}`}>
                        {h.price == null ? "no price" : `${formatUsd(h.price)} · ${gapWords(h.gapPct)}`}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Activity */}
        <section className="card p-5 lg:col-span-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-semibold">Recent activity</h2>
            <span className="text-muted text-xs">last {25} transactions scanned</span>
          </div>
          {d.activity.length === 0 ? (
            <p className="text-muted py-8 text-center text-sm">No stock trades in the recent history of this wallet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {d.activity.map((a) => (
                <li key={`${a.signature}-${a.mint}`}>
                  <a
                    href={`https://solscan.io/tx/${a.signature}`}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center gap-3 py-3 transition hover:opacity-80"
                  >
                    <TickerBadge symbol={a.symbol} logo={a.logo} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        <span className={a.kind === "bought" || a.kind === "received" ? "text-blue" : "text-ink"}>{KIND_LABEL[a.kind]}</span>{" "}
                        {trimAmount(a.amount)} {a.symbol}
                      </span>
                      <span className="text-muted num block text-xs">
                        {a.usd != null ? `${formatUsd(a.usd)} · ` : ""}
                        {when.format(new Date(a.ts))}
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
          <p className="text-muted mt-3 text-xs">Every row opens the transaction on Solscan. Nothing here is custodied by us; it is your wallet, read live.</p>
        </section>
      </div>
    </div>
  );
}

function trimAmount(n: number): string {
  if (n >= 100) return n.toFixed(2);
  if (n >= 1) return n.toFixed(3);
  return n.toFixed(4);
}
