"use client";

// A 24-hour bar of a New York trading day. White: Wall Street's regular
// session. Blue: after hours, when the onchain market is the only one open.
// A dot marks the time right now.

import { useEffect, useState } from "react";
import { getPhase, nyParts } from "@/lib/market-phase";

const OPEN = 9 * 60 + 30;
const CLOSE = 16 * 60;
const pct = (m: number) => `${(m / 1440) * 100}%`;

const clock = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });

export function SessionTimeline() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 1000);
    const raf = requestAnimationFrame(tick);
    return () => {
      clearInterval(id);
      cancelAnimationFrame(raf);
    };
  }, []);
  const minutes = now == null ? null : nyParts(new Date(now)).minutes;
  const phase = now == null ? null : getPhase(new Date(now)).phase;
  const afterHours = phase != null && phase !== "open";
  const tradingDay = phase != null && (phase === "open" || getPhase(new Date(now!)).msUntilOpen < 16 * 3600_000);

  return (
    <div className="mt-8">
      <div className="text-on-dark-muted mb-2 flex justify-between text-[11px]">
        <span>12 AM</span>
        <span>6 AM</span>
        <span>12 PM</span>
        <span>6 PM</span>
        <span>12 AM</span>
      </div>
      <div className="relative h-3 rounded-full bg-blue/80">
        <div className={`absolute inset-y-0 rounded-full ${tradingDay ? "bg-white" : "bg-white/30"}`} style={{ left: pct(OPEN), width: pct(CLOSE - OPEN) }} />
        {minutes != null && (
          <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: pct(minutes) }}>
            <div className="h-5 w-5 rounded-full border-[3px] border-ink bg-white shadow" />
          </div>
        )}
      </div>
      <div className="relative mt-2 h-5 text-[11px]">
        <span className="text-on-dark-muted absolute -translate-x-1/2" style={{ left: pct(OPEN) }}>
          9:30 AM open
        </span>
        <span className="text-on-dark-muted absolute -translate-x-1/2" style={{ left: pct(CLOSE) }}>
          4 PM close
        </span>
      </div>
      <p className="mt-3 text-sm">
        {minutes == null ? (
          <span className="text-on-dark-muted">Loading New York time…</span>
        ) : (
          <>
            <span className="num font-medium">{clock.format(new Date(now!))}</span> in New York:{" "}
            {afterHours ? (
              <span className="text-blue-light font-medium">
                After Hours. {phase === "closed" ? "Wall Street is closed today; onchain is the only market open." : "Onchain is the only market open."}
              </span>
            ) : (
              <span className="font-medium">Wall Street is open. Onchain tracks the exchange closely.</span>
            )}
          </>
        )}
      </p>
    </div>
  );
}
