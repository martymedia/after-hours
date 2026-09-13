import type { GapStats } from "@/lib/gap-stats";
import { Tip } from "./tip";

// "Did the gap close?" panel for one stock. Server component; the stats come
// from the last two weeks of snapshots and grow by one sample per open.

const dayFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  month: "short",
  day: "numeric",
});
const nextFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "long",
  hour: "numeric",
  minute: "2-digit",
});

export function GapHistory({
  stats,
  symbol,
  referencePhrase,
}: {
  stats: GapStats;
  symbol: string;
  referencePhrase: string;
}) {
  const n = stats.samples.length;
  return (
    <section className="card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">Did the gap close at the open?</h2>
        <Tip
          text="For every Wall Street open we compare the gap one minute before 9:30 with the gap thirty minutes after. A gap that at least halved counts as closed. Few opens mean weak evidence; we say how many."
          underline={false}
          className="text-muted-2 hover:text-ink shrink-0 text-xs"
        >
          How this is counted
        </Tip>
      </div>
      {n === 0 ? (
        <p className="text-muted mt-2 text-sm">
          Not enough history yet for {symbol}. The first read comes on{" "}
          {nextFmt.format(new Date(stats.nextOpenTs + 31 * 60_000))} New York
          time, thirty minutes after the bell, and every trading day adds one.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm">
            <span className="num text-2xl font-semibold">
              {Math.round((stats.closedShare ?? 0) * 100)}%
            </span>{" "}
            <span className="text-muted">
              of {n === 1 ? "the last open" : `the last ${n} opens`} closed the
              gap. On average {symbol} sat {stats.avgBefore?.toFixed(2)}% from{" "}
              {referencePhrase} before the bell and {stats.avgAfter?.toFixed(2)}
              % thirty minutes after.
            </span>
          </p>
          <ul className="mt-3 divide-y divide-line text-sm">
            {stats.samples.slice(0, 6).map((s) => (
              <li
                key={s.openTs}
                className="flex items-center justify-between py-2"
              >
                <span className="text-muted">
                  {dayFmt.format(new Date(s.openTs))}
                </span>
                <span className="num">
                  {s.before >= 0 ? "+" : ""}
                  {s.before.toFixed(2)}% <span className="text-muted-2">→</span>{" "}
                  {s.after >= 0 ? "+" : ""}
                  {s.after.toFixed(2)}%
                </span>
                <span
                  className={`pill ${s.closed ? "bg-soft-up text-up" : "bg-soft-warn text-warn"}`}
                >
                  {s.closed ? "closed" : "held"}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-muted mt-3 text-xs">
            {n < 5
              ? "Early days: fewer than five opens is a hint, not a pattern."
              : "A pattern, not a promise. The next open can still go the other way."}
          </p>
        </>
      )}
    </section>
  );
}
