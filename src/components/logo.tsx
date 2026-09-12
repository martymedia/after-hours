// Mark: a dark disc (night) with the three slanted Solana bars in the brand
// gradient. Wordmark next to it. One SVG, no image files.

type Props = { size?: number; withWordmark?: boolean; className?: string };

export function Logo({ size = 28, withWordmark = true, className = "" }: Props) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      {withWordmark && (
        <span className="text-ink font-semibold tracking-tight" style={{ fontSize: size * 0.68 }}>
          After Hours
        </span>
      )}
    </span>
  );
}

export function LogoMark({ size = 28 }: { size?: number }) {
  const id = "sol-gradient";
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#9945FF" />
          <stop offset="1" stopColor="#14F195" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <circle cx="20" cy="20" r="19" />
        </clipPath>
      </defs>
      <circle cx="20" cy="20" r="19" fill="#0f0f12" />
      <g clipPath={`url(#${id}-clip)`} fill={`url(#${id})`}>
        <path d="M9 14.5 L12.5 11 H33 L29.5 14.5 Z" />
        <path d="M11 21.5 L7.5 18 H28 L31.5 21.5 Z" />
        <path d="M9 28.5 L12.5 25 H33 L29.5 28.5 Z" />
      </g>
    </svg>
  );
}
