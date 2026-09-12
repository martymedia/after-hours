// Small hover/focus tooltip. Pure CSS, works with keyboard focus too.

type Props = { text: string; children: React.ReactNode; className?: string };

export function Tip({ text, children, className = "" }: Props) {
  return (
    <span className={`group relative inline-flex ${className}`}>
      <span tabIndex={0} className="cursor-help underline decoration-dotted decoration-[color:var(--muted-2)] underline-offset-4 outline-none">
        {children}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute top-full left-1/2 z-20 mt-1.5 hidden w-60 -translate-x-1/2 rounded-xl bg-ink px-3 py-2 text-left text-xs leading-relaxed font-normal text-white shadow-lg group-hover:block group-focus-within:block"
      >
        {text}
      </span>
    </span>
  );
}
