import type { PhaseInfo } from "@/lib/market-phase";
import { formatDuration } from "@/lib/format";

type Props = { phase: PhaseInfo; stockCount: number; now: number };

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "long",
  hour: "numeric",
  minute: "2-digit",
});

export function StatusLine({ phase, stockCount, now }: Props) {
  const untilOpen = formatDuration(new Date(phase.nextOpen).getTime() - now);
  const opensAt = dayFormatter.format(new Date(phase.nextOpen));

  let headline: string;
  let detail: string;
  if (phase.phase === "open") {
    const untilClose = phase.nextClose ? formatDuration(new Date(phase.nextClose).getTime() - now) : "";
    headline = "Wall Street is open.";
    detail = `Closes in ${untilClose}. Onchain prices track the real market closely right now.`;
  } else if (phase.phase === "after_hours") {
    headline = "Wall Street is closed for the night.";
    detail = `Overnight venues are still quoting, so prices below have a live reference. Regular session opens ${opensAt} ET, in ${untilOpen}.`;
  } else {
    headline = "Wall Street is closed.";
    detail = `Opens ${opensAt} ET, in ${untilOpen}. Prices below compare to Friday's close and can drift.`;
  }

  return (
    <header className="mb-8">
      <p className="text-muted mb-1 text-xs font-medium tracking-wide uppercase">Stocks trading now</p>
      <div className="sol-rule mb-3" />
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {headline}{" "}
        <span className="text-muted font-normal">
          {stockCount} stocks are trading onchain anyway.
        </span>
      </h1>
      <p className="text-muted mt-3 max-w-2xl text-sm leading-relaxed">{detail}</p>
    </header>
  );
}
