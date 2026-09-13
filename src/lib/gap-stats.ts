// Did the gap close at the open? For every Wall Street open in the data we
// hold (snapshots are kept 14 days), compare the onchain gap to the reference
// just before 9:30 New York with the gap 30 minutes after. A gap "closed" when
// it shrank by at least half. Honest by design: with few opens the numbers say
// so instead of pretending.

import { getPhase, nyParts } from "./market-phase.ts";
import { snapshotAt } from "./db.ts";

export type OpenSample = {
  /** Unix ms of that day's 9:30 New York. */
  openTs: number;
  /** Gap one minute before the open, percent. */
  before: number;
  /** Gap thirty minutes after the open, percent. */
  after: number;
  closed: boolean;
};

export type GapStats = {
  samples: OpenSample[];
  /** Share of opens where the gap at least halved, 0..1, null without samples. */
  closedShare: number | null;
  avgBefore: number | null;
  avgAfter: number | null;
  /** Next open we will be able to read, when there is no sample yet. */
  nextOpenTs: number;
};

const DAYS_BACK = 14;
const BEFORE_MS = 60_000;
const AFTER_MS = 30 * 60_000;

function gapOf(mint: string, ts: number): number | null {
  const s = snapshotAt(mint, ts);
  if (!s || s.usd_price == null || !s.ref_price) return null;
  return (s.usd_price / s.ref_price - 1) * 100;
}

/** 9:30 New York on the given UTC day, or null if Wall Street is shut that day. */
function openTsFor(dayUtc: Date): number | null {
  const y = dayUtc.getUTCFullYear();
  const m = dayUtc.getUTCMonth();
  const d = dayUtc.getUTCDate();
  // 13:30 UTC during daylight time, 14:30 during standard time; pick the one that reads 9:30 in New York.
  for (const hour of [13, 14]) {
    const ts = Date.UTC(y, m, d, hour, 30);
    const p = nyParts(new Date(ts));
    if (p.minutes === 570 && p.ymd === `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`) {
      // A trading day is one where the phase is open right after the bell.
      return getPhase(new Date(ts + 60_000)).phase === "open" ? ts : null;
    }
  }
  return null;
}

export function gapStats(mint: string, now = Date.now()): GapStats {
  const samples: OpenSample[] = [];
  for (let back = 0; back <= DAYS_BACK; back++) {
    const day = new Date(now - back * 86400_000);
    const openTs = openTsFor(new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate())));
    if (openTs == null || openTs + AFTER_MS > now) continue;
    const before = gapOf(mint, openTs - BEFORE_MS);
    const after = gapOf(mint, openTs + AFTER_MS);
    if (before == null || after == null) continue;
    samples.push({ openTs, before, after, closed: Math.abs(after) <= Math.abs(before) / 2 });
  }
  samples.sort((a, b) => b.openTs - a.openTs);
  const n = samples.length;
  return {
    samples,
    closedShare: n ? samples.filter((s) => s.closed).length / n : null,
    avgBefore: n ? samples.reduce((s, x) => s + Math.abs(x.before), 0) / n : null,
    avgAfter: n ? samples.reduce((s, x) => s + Math.abs(x.after), 0) / n : null,
    nextOpenTs: Date.parse(getPhase(new Date(now)).nextOpen),
  };
}

/** Aggregate over many stocks for the How page. */
export function gapStatsAcross(mints: string[], now = Date.now()): { opens: number; samples: number; closedShare: number | null; avgBefore: number | null; avgAfter: number | null } {
  const all = mints.flatMap((m) => gapStats(m, now).samples);
  const opens = new Set(all.map((s) => s.openTs)).size;
  const n = all.length;
  return {
    opens,
    samples: n,
    closedShare: n ? all.filter((s) => s.closed).length / n : null,
    avgBefore: n ? all.reduce((s, x) => s + Math.abs(x.before), 0) / n : null,
    avgAfter: n ? all.reduce((s, x) => s + Math.abs(x.after), 0) / n : null,
  };
}
