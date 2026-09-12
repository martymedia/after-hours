// Mark: the three slanted stripes, with the moon taking a bigger bite out of
// each one going down. Day turns into night, stripe by stripe. One color.
// Wordmark: "After" plain, "Hours" in a slanted box.

type Props = { size?: number; withWordmark?: boolean; className?: string; onDark?: boolean };

export function Logo({ size = 32, className = "", onDark = false, withWordmark = true }: Props) {
  const fontSize = size * 0.72;
  return (
    <span className={`inline-flex items-center gap-[0.35em] ${onDark ? "text-white" : "text-ink"} ${className}`} style={{ fontSize, lineHeight: 1 }}>
      <LogoMark size={size} />
      {withWordmark && (
        <span className="inline-flex items-baseline gap-[0.18em] font-bold tracking-tight">
          <span>After</span>
          <span className={`inline-block -skew-x-[8deg] rounded-[0.12em] px-[0.28em] py-[0.08em] ${onDark ? "bg-white text-ink" : "bg-ink text-white"}`}>
            <span className="inline-block skew-x-[8deg]">Hours</span>
          </span>
        </span>
      )}
    </span>
  );
}

export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className={className}>
      <defs>
        <mask id="ah-bites" maskUnits="userSpaceOnUse" x="0" y="0" width="40" height="40">
          <rect width="40" height="40" fill="#fff" />
          <circle cx="34.5" cy="5" r="3.2" fill="#000" />
          <circle cx="35" cy="24.5" r="4.6" fill="#000" />
          <circle cx="34" cy="27.5" r="6.2" fill="#000" />
        </mask>
      </defs>
      <g fill="currentColor" mask="url(#ah-bites)">
        {/* top stripe, leaning right */}
        <path d="M10 5 H34 L30.5 12 H6.5 Z" />
        {/* middle stripe, leaning left */}
        <path d="M6.5 16.5 H30.5 L34 23.5 H10 Z" />
        {/* bottom stripe, leaning right */}
        <path d="M10 28 H34 L30.5 35 H6.5 Z" />
      </g>
    </svg>
  );
}
