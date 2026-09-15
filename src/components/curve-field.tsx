// Decorative background for the Curves hero: a fan of bonding curves
// drawing themselves in, with a buyer's dot travelling up each one. Pure
// SVG with SMIL motion, so it renders on the server and needs no script.
// Curves are sqrt-price segments like the real ones: price against quote
// raised, steeper the further along.

const W = 800;
const H = 360;

type Curve = {
  ratio: number;
  x0: number;
  x1: number;
  dur: number;
  delay: number;
};

const CURVES: Curve[] = [
  { ratio: 4, x0: -40, x1: 620, dur: 14, delay: 0 },
  { ratio: 7, x0: 60, x1: 760, dur: 18, delay: 3 },
  { ratio: 12, x0: -80, x1: 520, dur: 11, delay: 6 },
  { ratio: 5.5, x0: 180, x1: 840, dur: 16, delay: 1.5 },
  { ratio: 9, x0: 300, x1: 900, dur: 13, delay: 8 },
  { ratio: 3, x0: -120, x1: 400, dur: 20, delay: 4 },
];

function path(c: Curve): string {
  const r = c.ratio;
  const s1 = Math.sqrt(r);
  const n = 32;
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const p = (1 + (s1 - 1) * f) ** 2;
    const x = c.x0 + f * (c.x1 - c.x0);
    const y = H - 24 - ((p - 1) / (r - 1)) * (H - 60);
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(" ");
}

export function CurveField({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMaxYMax slice"
      className={`curve-field pointer-events-none absolute inset-0 h-full w-full ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="cf-fade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8fb3ff" stopOpacity="0" />
          <stop offset="0.35" stopColor="#8fb3ff" stopOpacity="1" />
          <stop offset="1" stopColor="#8fb3ff" stopOpacity="1" />
        </linearGradient>
        <radialGradient id="cf-dot">
          <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="0.5" stopColor="#8fb3ff" stopOpacity="0.6" />
          <stop offset="1" stopColor="#8fb3ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {CURVES.map((c, i) => {
        const d = path(c);
        return (
          <g key={i}>
            <path
              id={`cf-c${i}`}
              d={d}
              fill="none"
              stroke="url(#cf-fade)"
              strokeWidth={1.1}
              strokeLinecap="round"
              className="cf-line"
              style={{ animationDelay: `${c.delay * 0.15}s` }}
              pathLength={1}
            />
            <circle r={6} fill="url(#cf-dot)" className="cf-dot">
              <animateMotion
                dur={`${c.dur}s`}
                begin={`${c.delay}s`}
                repeatCount="indefinite"
                calcMode="spline"
                keyTimes="0;1"
                keySplines="0.35 0 0.65 1"
              >
                <mpath href={`#cf-c${i}`} />
              </animateMotion>
            </circle>
            <circle r={1.6} fill="#fff" fillOpacity={0.8} className="cf-dot">
              <animateMotion
                dur={`${c.dur}s`}
                begin={`${c.delay}s`}
                repeatCount="indefinite"
                calcMode="spline"
                keyTimes="0;1"
                keySplines="0.35 0 0.65 1"
              >
                <mpath href={`#cf-c${i}`} />
              </animateMotion>
            </circle>
          </g>
        );
      })}
    </svg>
  );
}
