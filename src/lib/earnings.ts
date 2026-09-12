// Upcoming earnings dates for the stocks we track, from Nasdaq's public
// calendar (no key, needs a browser-like User-Agent). Earnings land after the
// close, which is exactly when onchain markets are the only ones open.

const NASDAQ = "https://api.nasdaq.com/api/calendar/earnings";

export type EarningsEvent = {
  symbol: string;
  /** YYYY-MM-DD in New York. */
  date: string;
  /** "before market", "after close" or "unknown". */
  timing: "before market" | "after close" | "unknown";
};

type NasdaqRow = { symbol: string; time?: string };

function timingOf(time: string | undefined): EarningsEvent["timing"] {
  if (time === "time-pre-market") return "before market";
  if (time === "time-after-hours") return "after close";
  return "unknown";
}

export async function fetchEarnings(symbols: Set<string>, days = 30): Promise<EarningsEvent[]> {
  const out: EarningsEvent[] = [];
  const start = new Date();
  for (let i = 0; i < days; i++) {
    const day = new Date(start.getTime() + i * 86400_000);
    const ymd = day.toISOString().slice(0, 10);
    if (day.getUTCDay() === 0 || day.getUTCDay() === 6) continue;
    try {
      const res = await fetch(`${NASDAQ}?date=${ymd}`, {
        headers: { "user-agent": "Mozilla/5.0", accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) continue;
      const body = (await res.json()) as { data?: { rows?: NasdaqRow[] } };
      for (const row of body.data?.rows ?? []) {
        if (symbols.has(row.symbol)) out.push({ symbol: row.symbol, date: ymd, timing: timingOf(row.time) });
      }
    } catch {
      // one bad day should not sink the calendar
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return out;
}
