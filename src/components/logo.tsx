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

// Each crescent: a disc of radius 12 whose top is cut away by a flatter disc
// (radius 15.84, centred 10.34 above), so the tips sit exactly on the centre
// line and the bowl is 6.5 thick at the bottom. Three of them, 1.5 apart.
const MOONS = [0.75, 14.25, 27.75];

export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className={className}>
      <defs>
        {MOONS.map((cy, i) => (
          <mask key={i} id={`ah-moon-${i}`} maskUnits="userSpaceOnUse" x="0" y="-20" width="40" height="80">
            <rect x="0" y="-20" width="40" height="80" fill="#fff" />
            <circle cx="20" cy={cy - 10.34} r="15.84" fill="#000" />
          </mask>
        ))}
      </defs>
      {MOONS.map((cy, i) => (
        <circle key={i} cx="20" cy={cy} r="12" fill="currentColor" mask={`url(#ah-moon-${i})`} />
      ))}
    </svg>
  );
}
