"use client";

// Counts a number up on first paint. Server renders the final value, so
// nothing jumps if JavaScript is slow; the client then eases it in.

import { useEffect, useState } from "react";

type Props = {
  value: number;
  format: (n: number) => string;
  /** Start at this fraction of the value (0 = from zero). */
  from?: number;
  durationMs?: number;
  className?: string;
};

export function CountUp({ value, format, from = 0, durationMs = 900, className = "" }: Props) {
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = performance.now();
    const startValue = value * from;
    let frame = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(startValue + (value - startValue) * eased);
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, from, durationMs]);

  return <span className={className}>{format(shown)}</span>;
}
