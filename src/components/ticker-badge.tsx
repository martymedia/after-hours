// Round badge with the first letters of the ticker, like an app icon.

const PALETTE = ["#121214", "#5b91ff", "#2f3340", "#3d6fd6", "#1e1f24"];

export function TickerBadge({ symbol, size = 36, dark = false }: { symbol: string; size?: number; dark?: boolean }) {
  const letters = symbol.replace(/x$|on$/i, "").slice(0, 2).toUpperCase();
  const idx = [...symbol].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length;
  const bg = dark ? "#ffffff" : PALETTE[idx];
  const fg = dark ? "#121214" : "#ffffff";
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.34 }}
      aria-hidden="true"
    >
      {letters}
    </span>
  );
}
