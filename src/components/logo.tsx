// Mark: a clock face with a gap on the right, and a price line that runs
// through it and keeps going past the edge. The market stops, the line does
// not. Ink only, one accent dot where the line leaves the circle.

type Props = { size?: number; withWordmark?: boolean; className?: string };

export function Logo({ size = 28, withWordmark = true, className = "" }: Props) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      {withWordmark && (
        <span className="font-display text-ink font-medium tracking-tight" style={{ fontSize: size * 0.8 }}>
          After Hours
        </span>
      )}
    </span>
  );
}

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" fill="none">
      {/* clock face, open on the right where the line exits */}
      <path
        d="M31.2 27.8 A13 13 0 1 1 31.2 12.2"
        stroke="var(--ink)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* the price line: flat inside the day, restless after the bell */}
      <path
        d="M9 24 L15 21.5 L19 23 L23.5 16 L27.5 18.5 L31.5 13.5 L38 10"
        stroke="var(--ink)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="38" cy="10" r="2.4" fill="var(--accent)" />
    </svg>
  );
}
