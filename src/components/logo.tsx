// Mark: a black app tile with a crescent moon (the night) and one blue light
// still on (onchain). No circle, no wave, nothing borrowed.

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
      <rect width="40" height="40" rx="11" fill="#121214" />
      {/* crescent: a disc minus an offset disc */}
      <path
        d="M22.5 8.5 A11.5 11.5 0 1 0 22.5 31.5 A9.2 9.2 0 1 1 22.5 8.5 Z"
        fill="#ffffff"
      />
      <circle cx="27.5" cy="14" r="2.6" fill="#5b91ff" />
    </svg>
  );
}
