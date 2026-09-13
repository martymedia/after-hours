"use client";

// Wallet page: turn on push for this device, and manage price alerts.
// Order fills, expiries and cancellations need no setup beyond the switch.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, BellOff, Trash2 } from "lucide-react";
import { formatPct } from "@/lib/format";
import {
  currentState,
  disablePush,
  enablePush,
  sendTestPush,
  type PushState,
} from "@/lib/push-client";
import { Seg } from "./motion";

type Alert = {
  id: number;
  mint: string;
  kind: "cheaper" | "pricier";
  threshold: number;
  fired_at: number | null;
  symbol: string;
  name: string;
  underlying: string;
  gapPct: number | null;
};
type StockOption = { mint: string; symbol: string; name: string };

const THRESHOLDS = [
  { id: "2", label: "2%" },
  { id: "3", label: "3%" },
  { id: "5", label: "5%" },
  { id: "10", label: "10%" },
];

export function NotificationsCard({
  owner,
  stocks,
}: {
  owner: string;
  stocks: StockOption[];
}) {
  const [state, setState] = useState<PushState | "loading">("loading");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [mint, setMint] = useState(stocks[0]?.mint ?? "");
  const [kind, setKind] = useState<"cheaper" | "pricier">("cheaper");
  const [threshold, setThreshold] = useState("3");

  const loadAlerts = useCallback(async () => {
    try {
      const res = await fetch(`/api/alerts?owner=${owner}`, {
        cache: "no-store",
      });
      const body = (await res.json()) as { alerts?: Alert[] };
      setAlerts(body.alerts ?? []);
    } catch {
      setAlerts([]);
    }
  }, [owner]);

  useEffect(() => {
    const id = setTimeout(async () => {
      setState(await currentState(owner));
      await loadAlerts();
    }, 0);
    return () => clearTimeout(id);
  }, [owner, loadAlerts]);

  async function toggle() {
    setBusy(true);
    setNote(null);
    try {
      if (state === "on") {
        await disablePush();
        setState("off");
        setNote("Notifications are off for this device.");
      } else {
        const next = await enablePush(owner);
        setState(next);
        if (next === "on") {
          const n = await sendTestPush(owner);
          setNote(
            n > 0
              ? "On. A test message is on its way."
              : "On. The test message could not be delivered yet; try again in a moment.",
          );
        } else if (next === "denied") {
          setNote(
            "Your browser blocks notifications for this site. Allow them in the site settings, then try again.",
          );
        }
      }
    } catch (err) {
      setNote((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function testPush() {
    setBusy(true);
    setNote(null);
    try {
      const n = await sendTestPush(owner);
      setNote(
        n > 0
          ? "Sent. It should show up on this device within a few seconds."
          : "No device accepted it. Turn notifications off and on again.",
      );
    } catch (err) {
      setNote((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addAlert() {
    if (!mint) return;
    setBusy(true);
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          owner,
          mint,
          kind,
          threshold: Number(threshold),
        }),
      });
      if (!res.ok) throw new Error("Could not save the alert.");
      await loadAlerts();
    } catch (err) {
      setNote((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeAlert(id: number) {
    await fetch("/api/alerts", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ owner, id }),
    });
    await loadAlerts();
  }

  const on = state === "on";
  // Desktop browsers only. Phones (iOS, wallet in-app browsers) get no card.
  if (state === "unsupported" || state === "needs-install") return null;
  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            {on ? (
              <Bell size={16} strokeWidth={1.75} className="text-blue" />
            ) : (
              <BellOff size={16} strokeWidth={1.75} className="text-muted" />
            )}
            Notifications
          </h2>
          <p className="text-muted mt-1 text-sm">
            {state === "loading"
              ? "Checking this device…"
              : state === "denied"
                ? "Blocked in your browser settings for this site."
                : on
                  ? "Order fills, expiries and cancellations, plus your price alerts, arrive on this device."
                  : "Get a message when a limit order fills or expires, and when a stock hits your price."}
          </p>
        </div>
        {(state === "on" || state === "off") && (
          <div className="flex shrink-0 gap-2">
            {on && (
              <button
                type="button"
                onClick={testPush}
                disabled={busy}
                className="btn btn-sm"
              >
                Send a test
              </button>
            )}
            <button
              type="button"
              onClick={toggle}
              disabled={busy}
              className={`btn btn-sm ${on ? "border border-line bg-card text-ink hover:bg-soft" : ""}`}
            >
              {busy ? "…" : on ? "Turn off" : "Turn on"}
            </button>
          </div>
        )}
      </div>
      {note && <p className="text-muted mt-3 text-sm">{note}</p>}

      {/* Price alerts: only once messages can actually arrive. */}
      {(on || (alerts && alerts.length > 0)) && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-sm font-medium">Price alerts</p>
          <p className="text-muted mt-0.5 text-xs">
            One message when the onchain price crosses your line against the
            last Wall Street print. Fires once, then stays listed until you
            remove it.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
            <select
              value={mint}
              onChange={(e) => setMint(e.target.value)}
              className="h-9 min-w-0 rounded-full bg-soft px-3 text-sm font-medium outline-none"
              aria-label="Stock"
            >
              {stocks.map((s) => (
                <option key={s.mint} value={s.mint}>
                  {s.name} ({s.symbol})
                </option>
              ))}
            </select>
            <div className="seg" role="group" aria-label="Direction">
              <button
                type="button"
                onClick={() => setKind("cheaper")}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${kind === "cheaper" ? "bg-blue text-white" : "text-muted hover:text-ink"}`}
              >
                cheaper
              </button>
              <button
                type="button"
                onClick={() => setKind("pricier")}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${kind === "pricier" ? "bg-down text-white" : "text-muted hover:text-ink"}`}
              >
                pricier
              </button>
            </div>
            <Seg
              ariaLabel="Threshold"
              value={threshold}
              onChange={setThreshold}
              options={THRESHOLDS}
            />
            <button
              type="button"
              onClick={addAlert}
              disabled={busy || !mint || !on}
              className="btn btn-sm"
              title={on ? undefined : "Turn notifications on first"}
            >
              Add alert
            </button>
          </div>
          {!on && state !== "loading" && (
            <p className="text-muted mt-2 text-xs">
              Turn notifications on to add alerts.
            </p>
          )}
          {alerts && alerts.length > 0 && (
            <ul className="mt-3 divide-y divide-line">
              {alerts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-3 py-2.5 text-sm"
                >
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${a.kind === "cheaper" ? "bg-blue" : "bg-down"}`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <Link
                      href={`/stock/${a.underlying || a.symbol}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {a.name}
                    </Link>{" "}
                    <span
                      className={
                        a.kind === "cheaper" ? "text-blue" : "text-down"
                      }
                    >
                      {formatPct(a.threshold).replace("+", "")} {a.kind}
                    </span>
                    <span className="text-muted"> than Wall Street</span>
                  </span>
                  {a.gapPct != null && !a.fired_at && (
                    <span
                      className="text-muted num hidden text-xs sm:inline"
                      title="Where the onchain price is right now"
                    >
                      now {Math.abs(a.gapPct).toFixed(1)}%{" "}
                      {a.gapPct < 0 ? "cheaper" : "pricier"}
                    </span>
                  )}
                  <span
                    className={`pill ${a.fired_at ? "bg-soft text-muted" : "pill-blue"}`}
                  >
                    {a.fired_at ? "sent" : "waiting"}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAlert(a.id)}
                    className="icon-badge text-muted hover:text-ink h-8 w-8"
                    aria-label="Remove alert"
                  >
                    <Trash2 size={14} strokeWidth={1.75} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
