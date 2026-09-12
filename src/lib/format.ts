export function formatUsd(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "–";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatPct(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "–";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function formatCompactUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "–";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${Math.round(value)}`;
}

/** "2m ago", "3h ago", "2d ago". */
export function formatAgo(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** "38h 12m", "2d 4h", "45m". */
export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Color class for a gap: cheaper onchain is blue, pricier is red, tiny is muted. */
export function gapTone(gap: number | null | undefined): string {
  if (gap == null || !Number.isFinite(gap) || Math.abs(gap) < 0.25) return "text-muted";
  return gap < 0 ? "text-blue" : "text-down";
}

/** "0.68% pricier", "2.4% cheaper", "in line". */
export function gapWords(gap: number | null | undefined): string {
  if (gap == null || !Number.isFinite(gap)) return "–";
  const abs = Math.abs(gap);
  if (abs < 0.25) return "in line";
  return `${abs.toFixed(2)}% ${gap < 0 ? "cheaper" : "pricier"}`;
}

/** "2 days 3 hours", "4 hours 12 minutes", "38 minutes". */
export function formatDurationWords(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  const unit = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  if (d > 0) return `${unit(d, "day")} ${unit(h, "hour")}`;
  if (h > 0) return `${unit(h, "hour")} ${unit(m, "minute")}`;
  return unit(m, "minute");
}

/** "0.68% pricier than Friday's close" or "in line with Friday's close". */
export function gapSentence(gap: number | null | undefined, phrase: string): string {
  const words = gapWords(gap);
  if (words === "–") return `no comparison to ${phrase}`;
  return words === "in line" ? `in line with ${phrase}` : `${words} than ${phrase}`;
}
