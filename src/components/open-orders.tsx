"use client";

// Open limit orders of a wallet, with cancel for the owner. Data comes from
// Jupiter through /api/orders; cancelling builds a transaction the wallet signs.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  getBase58Decoder,
  getBase64Encoder,
  getTransactionDecoder,
} from "@solana/kit";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { MoonStar } from "lucide-react";
import { solanaClient } from "@/lib/solana-client";
import { formatUsd } from "@/lib/format";
import type { OpenOrder } from "@/app/api/orders/route";
import { explainError, waitForConfirmation } from "./buy-button";
import { TickerBadge } from "./ticker-badge";

const when = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

export function OpenOrders({
  owner,
  readOnly,
}: {
  owner: string;
  readOnly: boolean;
}) {
  const connected = useConnectedWallet(solanaClient);
  const [orders, setOrders] = useState<OpenOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders?owner=${owner}`, {
        cache: "no-store",
      });
      const body = (await res.json()) as {
        orders?: OpenOrder[];
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? "");
      setOrders(body.orders ?? []);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [owner]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const id = setInterval(load, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [load]);

  async function cancel(o: OpenOrder) {
    if (!connected?.signer || !("signAndSendTransactions" in connected.signer))
      return;
    setBusy(o.order);
    setNote(null);
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "cancel",
          order: o.order,
          userPublicKey: connected.account.address,
        }),
      });
      const body = (await res.json()) as {
        transaction?: string;
        error?: string;
      };
      if (!res.ok || !body.transaction)
        throw new Error(body.error ?? "could not build the cancel");
      const tx = getTransactionDecoder().decode(
        getBase64Encoder().encode(body.transaction),
      );
      const [raw] = await connected.signer.signAndSendTransactions([tx]);
      await waitForConfirmation(getBase58Decoder().decode(raw));
      setNote(
        `Cancelled. ${formatUsd(o.usd * o.remaining)} is back in your wallet.`,
      );
      setTimeout(load, 1500);
    } catch (err) {
      const [title, hint] = explainError((err as Error).message ?? String(err));
      setNote(`${title} ${hint}`);
    } finally {
      setBusy(null);
    }
  }

  if (orders && orders.length === 0 && !error) return null;

  return (
    <section className="card p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="flex items-center gap-2 font-semibold">
          <MoonStar size={16} strokeWidth={1.75} className="text-blue" />
          Orders waiting for a price
        </h2>
        <span className="text-muted text-xs">
          Jupiter Trigger, owned by this wallet
        </span>
      </div>
      {error ? (
        <p className="text-muted text-sm">
          Could not read the orders right now.
          {error ? ` ${error.charAt(0).toUpperCase()}${error.slice(1)}.` : ""}
        </p>
      ) : !orders ? (
        <div className="h-16 animate-pulse rounded-2xl bg-soft" />
      ) : (
        <ul className="divide-y divide-line">
          {orders.map((o) => (
            <li key={o.order} className="flex items-center gap-3 py-3">
              <Link
                href={`/stock/${o.underlying}`}
                className="shrink-0 transition hover:opacity-80"
                aria-label={`${o.name} stock page`}
              >
                <TickerBadge symbol={o.symbol} logo={o.logo} size={36} />
              </Link>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  <span className="text-blue">
                    {o.side === "buy" ? "Buy" : "Sell"}
                  </span>{" "}
                  {o.shares >= 1 ? o.shares.toFixed(3) : o.shares.toFixed(4)}{" "}
                  {o.symbol} at {formatUsd(o.price)}
                </span>
                <span className="text-muted num block text-xs">
                  {formatUsd(o.usd)} waiting
                  {o.remaining < 0.999
                    ? ` · ${Math.round(o.remaining * 100)}% left`
                    : ""}
                  {o.expiresAt
                    ? ` · until ${when.format(new Date(o.expiresAt))}`
                    : " · no expiry"}
                </span>
                {o.now != null && o.distancePct != null && (
                  <span className="num block text-xs">
                    <span className="text-muted">
                      now {formatUsd(o.now)} ·{" "}
                    </span>
                    {o.distancePct <= 0 ? (
                      <span className="text-blue">at your price, filling</span>
                    ) : (
                      <span
                        className={o.distancePct < 1 ? "text-blue" : "text-ink"}
                      >
                        {o.side === "buy" ? "needs to fall" : "needs to rise"}{" "}
                        {o.distancePct.toFixed(1)}%
                      </span>
                    )}
                  </span>
                )}
              </span>
              {!readOnly && connected ? (
                <button
                  type="button"
                  onClick={() => cancel(o)}
                  disabled={busy === o.order}
                  className="pill shrink-0 border border-line bg-card text-ink hover:border-ink disabled:opacity-50"
                >
                  {busy === o.order ? "Cancelling…" : "Cancel"}
                </button>
              ) : (
                <Link
                  href={`/stock/${o.underlying}`}
                  className="text-muted-2 hover:text-ink text-xs"
                >
                  View
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
      {note && <p className="text-muted mt-3 text-sm">{note}</p>}
    </section>
  );
}
