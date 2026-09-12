// Mark: the sun sets behind the horizon, the price line keeps climbing.
// Market closes, trading does not. One color, three shapes, reads at 24px.
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
      {/* setting sun: a half disc on the horizon */}
      <path d="M11 28 A9 9 0 0 1 29 28 Z" fill="currentColor" />
      {/* horizon */}
      <path d="M4 28 H36" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      {/* the price line keeps going after the close */}
      <path d="M8 21 L15 13 L21 18 L33 7" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
