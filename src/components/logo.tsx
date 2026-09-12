// Mark: three stacked crescent moons in the rhythm of the Solana stripes.
// One color.
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

const MOONS = [6.5, 17.5, 28.5];

export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  // Three stacked crescents, bowls open to the sky: the Solana stripes, read
  // as moons. Each crescent is a disc with a second disc cut out above it;
  // every crescent has its own mask so the cutouts never touch a neighbour.
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className={className}>
      <defs>
        {MOONS.map((cy, i) => (
          <mask key={i} id={`ah-moon-${i}`} maskUnits="userSpaceOnUse" x="0" y="0" width="40" height="40">
            <rect width="40" height="40" fill="#fff" />
            <circle cx="20" cy={cy - 4.9} r="9.2" fill="#000" />
          </mask>
        ))}
      </defs>
      {MOONS.map((cy, i) => (
        <circle key={i} cx="20" cy={cy} r="9.6" fill="currentColor" mask={`url(#ah-moon-${i})`} />
      ))}
    </svg>
  );
}
