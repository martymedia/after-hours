"use client";

// The dark hero panel: headline and status on the left, the lit globe on the
// right. Client-only because WebGL and the clock only exist in the browser.

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { PhaseInfo } from "@/lib/market-phase";
import { formatDuration } from "@/lib/format";

const Globe = dynamic(() => import("./globe").then((m) => m.Globe), {
  ssr: false,
  loading: () => <div className="aspect-square w-full" aria-hidden="true" />,
});

const nyClock = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
  minute: "2-digit",
});

type Props = { phase: PhaseInfo; stockCount: number; generatedAt: string };

export function GlobeHero({ phase, stockCount, generatedAt }: Props) {
  const [now, setNow] = useState(() => Date.parse(generatedAt));
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const untilOpen = formatDuration(new Date(phase.nextOpen).getTime() - now);
  const status =
    phase.phase === "open"
      ? "Wall Street is open"
      : phase.phase === "after_hours"
        ? "Wall Street is closed for the night"
        : "Wall Street is closed";

  return (
    <section className="card-dark relative overflow-hidden">
      <div className="grid items-center gap-6 p-6 sm:p-8 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <p className="text-blue-light text-sm font-medium">Trade stocks when Wall Street sleeps.</p>
          <h2 className="mt-2 text-[2.4rem] leading-[1.02] font-semibold tracking-tight sm:text-6xl">
            Solana After Hours
          </h2>
          <p className="text-on-dark-muted mt-5 max-w-md leading-relaxed">
            Real stocks, tokenized on Solana, keep trading after the bell and all weekend. See what is moving,
            whether the price is fresh, and how much cheaper or dearer it is than the last Wall Street print.
            Then buy from your own wallet.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link href="/stocks" className="btn btn-white">
              See what is trading
            </Link>
            <Link href="/how" className="text-on-dark-muted text-sm hover:text-white">
              How it works
            </Link>
          </div>
          <div className="mt-8 text-sm">
            <div>
              <span className="num font-medium">{nyClock.format(new Date(now))}</span> in New York. {status}.
              {phase.phase !== "open" && <span className="text-on-dark-muted"> Opens in {untilOpen}.</span>}
            </div>
            <div className="text-blue-light font-medium">{stockCount} stocks are trading onchain right now.</div>
          </div>
        </div>
        <div className="lg:col-span-6">
          <Globe className="mx-auto max-w-[540px] lg:translate-x-8" />
        </div>
      </div>
    </section>
  );
}
