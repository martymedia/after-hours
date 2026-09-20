// Background for the pre-IPO panels: a few marks drawn as dashed lines with
// buyers drifting along them, above the line when they pay more than the
// mark and below when they pay less. Pure SVG with SMIL, so it renders on
// the server and needs no script.

const W = 800;
const H = 320;

type Lane = { y: number; dur: number; delay: number; offset: number };

const LANES: Lane[] = [
  { y: 58, dur: 26, delay: 0, offset: -18 },
  { y: 124, dur: 34, delay: 6, offset: 14 },
  { y: 190, dur: 22, delay: 3, offset: -10 },
  { y: 256, dur: 30, delay: 9, offset: 20 },
];

export function MarkField({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className={`mark-field pointer-events-none absolute inset-0 h-full w-full ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="mf-fade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.3" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.5" />
        </linearGradient>
        <radialGradient id="mf-up">
          <stop offset="0" stopColor="#ff8a8f" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ff8a8f" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mf-down">
          <stop offset="0" stopColor="#8fb3ff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#8fb3ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {LANES.map((l, i) => {
        const above = i % 2 === 0;
        return (
          <g key={l.y}>
            {/* The mark itself */}
            <line
              x1={0}
              y1={l.y}
              x2={W}
              y2={l.y}
              stroke="url(#mf-fade)"
              strokeWidth={1}
              strokeDasharray="5 7"
            />
            {/* A buyer, drifting along it on one side or the other */}
            <circle
              r={above ? 16 : 13}
              cy={l.y + l.offset}
              fill={above ? "url(#mf-up)" : "url(#mf-down)"}
            >
              <animate
                attributeName="cx"
                values={`-40;${W + 40}`}
                dur={`${l.dur}s`}
                begin={`${l.delay}s`}
                repeatCount="indefinite"
              />
            </circle>
            <circle
              r={2.5}
              cy={l.y + l.offset}
              fill="#fff"
              fillOpacity={0.75}
            >
              <animate
                attributeName="cx"
                values={`-40;${W + 40}`}
                dur={`${l.dur}s`}
                begin={`${l.delay}s`}
                repeatCount="indefinite"
              />
            </circle>
          </g>
        );
      })}
    </svg>
  );
}
