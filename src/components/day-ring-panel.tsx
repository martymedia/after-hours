"use client";

// The 3D day ring with a live New York clock in its centre and a legend
// underneath. Client-only: WebGL and the clock exist in the browser only.

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { getPhase } from "@/lib/market-phase";
import { formatDurationWords } from "@/lib/format";

const DayRing = dynamic(() => import("./day-ring").then((m) => m.DayRing), {
  ssr: false,
  loading: () => <div className="aspect-square w-full" aria-hidden="true" />,
});

const nyClock = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
  minute: "2-digit",
});

export function DayRingPanel() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);
  const phase = now == null ? null : getPhase(new Date(now));

  return (
    <div className="relative mx-auto w-full max-w-[460px]">
      <DayRing />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="rise rounded-2xl bg-ink/70 px-4 py-3 text-center backdrop-blur-sm">
          {now == null || !phase ? (
            <div className="text-on-dark-muted text-xs">New York time…</div>
          ) : (
            <>
              <div className="num text-lg font-semibold leading-tight">
                {nyClock.format(new Date(now))}
              </div>
              {phase.phase === "open" ? (
                <div className="text-on-dark-muted text-xs">
                  Wall Street open · closes in{" "}
                  <span className="text-white">
                    {phase.nextClose
                      ? formatDurationWords(
                          new Date(phase.nextClose).getTime() - now,
                        )
                      : "a few hours"}
                  </span>
                </div>
              ) : (
                <div className="text-on-dark-muted text-xs">
                  <span className="text-blue-light font-medium">
                    After Hours
                  </span>{" "}
                  · Wall Street opens in{" "}
                  <span className="text-white">
                    {formatDurationWords(
                      new Date(phase.nextOpen).getTime() - now,
                    )}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <ul className="text-on-dark-muted mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px]">
        <li className="flex items-center gap-1.5">
          <span className="h-1.5 w-4 rounded-full bg-white" /> Wall Street
          session
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-1.5 w-4 rounded-full bg-blue/60" /> Onchain, all
          day
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-white" /> Now
        </li>
      </ul>
    </div>
  );
}
