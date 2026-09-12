// Wordmark: "After" plain, "Hours" in a slanted black box with white type.
// On dark panels the box inverts. The compact mark is the same box with "AH".

type Props = { size?: number; withWordmark?: boolean; className?: string; onDark?: boolean };

export function Logo({ size = 32, className = "", onDark = false }: Props) {
  const fontSize = size * 0.72;
  return (
    <span
      className={`inline-flex items-baseline gap-[0.18em] font-bold tracking-tight ${onDark ? "text-white" : "text-ink"} ${className}`}
      style={{ fontSize, lineHeight: 1 }}
    >
      <span>After</span>
      <span
        className={`inline-block -skew-x-[8deg] rounded-[0.12em] px-[0.28em] py-[0.08em] ${onDark ? "bg-white text-ink" : "bg-ink text-white"}`}
      >
        <span className="inline-block skew-x-[8deg]">Hours</span>
      </span>
    </span>
  );
}

export function LogoMark({ size = 32, onDark = false }: { size?: number; onDark?: boolean }) {
  return (
    <span
      className={`inline-flex -skew-x-[8deg] items-center justify-center rounded-[0.2em] font-bold tracking-tight ${
        onDark ? "bg-white text-ink" : "bg-ink text-white"
      }`}
      style={{ width: size * 1.15, height: size, fontSize: size * 0.5 }}
      aria-hidden="true"
    >
      <span className="inline-block skew-x-[8deg]">AH</span>
    </span>
  );
}
