// US equity market phase, computed in America/New_York.
//
// Phases are deliberately coarse so a beginner understands them:
//   open        regular Nasdaq/NYSE session, a live reference price exists
//   after_hours pre-market, post-market and the Blue Ocean overnight session,
//               a live (thinner) reference exists
//   closed      weekend or holiday, the reference is the last close
//
// Blue Ocean overnight runs 20:00 to 04:00 ET, Sunday night through Friday
// morning. There is no Friday night session.

export type Phase = "open" | "after_hours" | "closed";

export type PhaseInfo = {
  phase: Phase;
  /** Next regular-session open, ISO string. */
  nextOpen: string;
  /** Milliseconds until nextOpen. */
  msUntilOpen: number;
  /** Next regular-session close if currently open, otherwise null. */
  nextClose: string | null;
};

// Full-day closures. Source: Nasdaq calendar as published in Pyth's equity
// feed schedules (US holidays 2026 and 2027).
const HOLIDAYS = new Set([
  "2026-01-01",
  "2026-01-19",
  "2026-02-16",
  "2026-04-03",
  "2026-05-25",
  "2026-06-19",
  "2026-07-03",
  "2026-09-07",
  "2026-11-26",
  "2026-12-25",
  "2027-01-01",
  "2027-01-18",
  "2027-02-15",
  "2027-03-26",
  "2027-05-31",
  "2027-06-18",
  "2027-07-05",
  "2027-09-06",
  "2027-11-25",
  "2027-12-24",
]);

// Early closes at 13:00 ET.
const HALF_DAYS = new Set(["2026-11-27", "2026-12-24", "2027-11-26"]);

const NY = "America/New_York";

type NyParts = {
  ymd: string;
  weekday: number; // 0 = Sunday
  minutes: number; // minutes since midnight, NY local
};

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: NY,
  weekday: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function nyParts(date: Date): NyParts {
  const p: Record<string, string> = {};
  for (const part of partsFormatter.formatToParts(date)) {
    p[part.type] = part.value;
  }
  const hour = p.hour === "24" ? 0 : Number(p.hour);
  return {
    ymd: `${p.year}-${p.month}-${p.day}`,
    weekday: WEEKDAYS.indexOf(p.weekday),
    minutes: hour * 60 + Number(p.minute),
  };
}

/** Today's date in New York as YYYY-MM-DD. */
export function nyYmd(date: Date = new Date()): string {
  return nyParts(date).ymd;
}

/** UTC offset of New York (in minutes) at the given instant. */
function nyOffsetMinutes(date: Date): number {
  const p = nyParts(date);
  const [y, m, d] = p.ymd.split("-").map(Number);
  const asUtc = Date.UTC(y, m - 1, d, Math.floor(p.minutes / 60), p.minutes % 60);
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** Instant for a New York local wall-clock time. */
function nyLocalToDate(ymd: string, minutes: number): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60));
  // Two passes handle DST transitions well enough for our purposes.
  let result = new Date(guess.getTime() - nyOffsetMinutes(guess) * 60000);
  result = new Date(guess.getTime() - nyOffsetMinutes(result) * 60000);
  return result;
}

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

function weekdayOf(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function isTradingDay(ymd: string): boolean {
  const wd = weekdayOf(ymd);
  return wd !== 0 && wd !== 6 && !HOLIDAYS.has(ymd);
}

const OPEN = 9 * 60 + 30;
const CLOSE = 16 * 60;
const HALF_CLOSE = 13 * 60;
const OVERNIGHT_START = 20 * 60;
const OVERNIGHT_END = 4 * 60;

export function getPhase(now: Date = new Date()): PhaseInfo {
  const p = nyParts(now);
  const today = p.ymd;
  const tradingToday = isTradingDay(today);
  const closeToday = HALF_DAYS.has(today) ? HALF_CLOSE : CLOSE;

  let phase: Phase = "closed";
  if (tradingToday && p.minutes >= OPEN && p.minutes < closeToday) {
    phase = "open";
  } else if (tradingToday && p.minutes < OPEN) {
    // Early morning of a trading day: overnight session (from 04:00 it is
    // pre-market). Both count as after hours. Only if the previous evening
    // had a session, i.e. yesterday was not a Saturday: Sunday evening runs.
    phase = "after_hours";
  } else if (tradingToday && p.minutes >= closeToday && p.minutes < OVERNIGHT_START) {
    phase = "after_hours";
  } else if (tradingToday && p.minutes >= OVERNIGHT_START) {
    // Evening of a trading day: overnight session runs unless the next day
    // is a full closure (Friday evening, or the eve of a holiday).
    phase = isTradingDay(addDays(today, 1)) ? "after_hours" : "closed";
  } else if (!tradingToday && p.weekday === 0 && p.minutes >= OVERNIGHT_START) {
    // Sunday evening: overnight session opens for Monday if Monday trades.
    phase = isTradingDay(addDays(today, 1)) ? "after_hours" : "closed";
  } else if (!tradingToday && p.minutes < OVERNIGHT_END && isTradingDay(addDays(today, -1)) === false) {
    phase = "closed";
  }

  // Next regular open.
  let day = today;
  if (!(tradingToday && p.minutes < OPEN)) {
    day = addDays(today, 1);
  }
  while (!isTradingDay(day)) day = addDays(day, 1);
  const nextOpenDate = nyLocalToDate(day, OPEN);

  const nextClose = phase === "open" ? nyLocalToDate(today, closeToday).toISOString() : null;

  return {
    phase,
    nextOpen: nextOpenDate.toISOString(),
    msUntilOpen: nextOpenDate.getTime() - now.getTime(),
    nextClose,
  };
}

/** True when a live reference price exists (Nasdaq or Blue Ocean). */
export function hasLiveReference(phase: Phase): boolean {
  return phase !== "closed";
}

export type ReferenceLabel = {
  /** Column header, e.g. "Friday close". */
  short: string;
  /** Mid-sentence phrase, e.g. "Friday's close". */
  phrase: string;
};

/** What the reference price is right now, in plain words. */
export function referenceLabel(phase: Phase, now: Date = new Date()): ReferenceLabel {
  if (phase !== "closed") return { short: "Wall Street", phrase: "the Wall Street price" };
  const weekday = nyParts(now).weekday;
  if (weekday === 6 || weekday === 0) return { short: "Friday close", phrase: "Friday's close" };
  return { short: "Last close", phrase: "the last close" };
}
