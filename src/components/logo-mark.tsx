// The company's own logo, very large and very faint, as the texture of a
// panel. Decorative only: it carries no information the page does not say
// in words, so it is hidden from assistive tech and never blocks a click.

export function LogoMark({
  logo,
  className = "",
  size = 220,
  opacity = 0.07,
}: {
  logo: string | null;
  className?: string;
  size?: number;
  opacity?: number;
}) {
  if (!logo) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      className={`pointer-events-none absolute select-none ${className}`}
      style={{ width: size, height: size, opacity }}
    />
  );
}
