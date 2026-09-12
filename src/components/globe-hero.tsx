"use client";

// The globe plus its caption: New York's local time and whether the bell has
// rung. Client-only because WebGL and the clock only exist in the browser.

import dynamic from "next/dynamic";
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
      ? "Wall Street is open."
      : phase.phase === "after_hours"
        ? "Wall Street is closed for the night."
        : "Wall Street is closed.";

  return (
    <figure className="mx-auto max-w-[520px]">
      <Globe />
      <figcaption className="mt-2 text-sm leading-relaxed">
        <span className="num">{nyClock.format(new Date(now))}</span> in New York. {status}{" "}
        {phase.phase !== "open" && <span className="text-muted">Opens in {untilOpen}.</span>}{" "}
        <span className="text-accent font-medium">{stockCount} stocks are trading onchain right now.</span>
      </figcaption>
    </figure>
  );
}
