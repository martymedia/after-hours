// Mark: the open clock face with the price line running past its edge, set
// in a blue disc. Wordmark in Outfit.

type Props = { size?: number; withWordmark?: boolean; className?: string };

export function Logo({ size = 32, withWordmark = true, className = "" }: Props) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      {withWordmark && (
        <span className="font-semibold tracking-tight" style={{ fontSize: size * 0.62 }}>
          After Hours
        </span>
      )}
    </span>
  );
}

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" fill="none">
      <circle cx="20" cy="20" r="20" fill="var(--blue)" />
      <path d="M28.6 25.2 A9.6 9.6 0 1 1 28.6 14.8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <path
        d="M12 23 L16.5 21 L19.5 22.2 L23 17 L26 18.8 L29 15 L34 12.5"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
