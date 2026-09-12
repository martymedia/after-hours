// Round badge with the company's logo when the issuer provides one, letters
// of the ticker otherwise.

const PALETTE = ["#121214", "#5b91ff", "#2f3340", "#3d6fd6", "#1e1f24"];

type Props = { symbol: string; logo?: string | null; size?: number; dark?: boolean };

export function TickerBadge({ symbol, logo, size = 36, dark = false }: Props) {
  if (logo) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-black/5"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        {/* Issuer-hosted PNGs; next/image would only add a proxy hop. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt="" width={size} height={size} className="h-full w-full object-cover" loading="lazy" />
      </span>
    );
  }
  const letters = symbol.replace(/x$|on$/i, "").slice(0, 2).toUpperCase();
  const idx = [...symbol].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{ width: size, height: size, background: dark ? "#ffffff" : PALETTE[idx], color: dark ? "#121214" : "#ffffff", fontSize: size * 0.34 }}
      aria-hidden="true"
    >
      {letters}
    </span>
  );
}
