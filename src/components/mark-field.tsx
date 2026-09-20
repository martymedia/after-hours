// Background for the pre-IPO panels: price paths wandering around a mark.
//
// Three things make this read as depth rather than as decoration. The paths
// are built from whole-numbered harmonics over one tile width, so a tile
// joins its neighbour at the same height and the same slope and the loop has
// no seam to spot. Each layer drifts at its own speed, which is parallax, so
// the eye reads them as near and far instead of as one sheet sliding past.
// And the stroke runs through a gradient split exactly on the mark line, so
// a path turns red where buyers pay more than the mark and blue where they
// pay less, which is the same language as every chart on the page.
//
// Pure SVG, rendered on the server. The drift is a CSS animation rather than
// SMIL so that a reader who asked for less motion actually gets a still
// picture: SMIL cannot be turned off from a media query.
//
// There is deliberately no blur filter here. A feGaussianBlur under a moving
// transform has to be rasterised again every frame, and on a phone that is
// what made this stutter. A wide, round-capped, low-opacity stroke gives the
// same softness for nothing. The back layer is also dropped below the sm
// breakpoint, so a phone animates two paths rather than three.

const W = 800;
const H = 320;
const MARK_Y = 168;
/** How far a path wanders is capped, so it never leaves the panel. */
const TILE = W;

type Harmonic = [cycles: number, amplitude: number, phase: number];

/**
 * One tile of a wandering path. Every harmonic completes a whole number of
 * cycles across the tile, which is what makes the repeat invisible.
 */
function tilePoints(harmonics: Harmonic[]): number[] {
  const ys: number[] = [];
  for (let x = 0; x <= TILE; x += 8) {
    let y = MARK_Y;
    for (const [cycles, amp, phase] of harmonics) {
      y += amp * Math.sin((2 * Math.PI * cycles * x) / TILE + phase);
    }
    ys.push(y);
  }
  return ys;
}

/** Three tiles side by side, so the group can slide one tile and repeat. */
function pathOf(harmonics: Harmonic[]): string {
  const ys = tilePoints(harmonics);
  const parts: string[] = [];
  for (let tile = 0; tile < 3; tile++) {
    // The last point of a tile is the first of the next, so it is skipped.
    const upto = tile === 2 ? ys.length : ys.length - 1;
    for (let i = 0; i < upto; i++) {
      const x = tile * TILE + i * 8;
      parts.push(`${parts.length === 0 ? "M" : "L"}${x},${ys[i].toFixed(2)}`);
    }
  }
  return parts.join(" ");
}

type Layer = {
  harmonics: Harmonic[];
  width: number;
  opacity: number;
  /** Seconds for one tile to pass. Slower reads as further away. */
  dur: number;
  /** Dropped on small screens, where every animated layer costs a frame. */
  wideOnly?: boolean;
};

const LAYERS: Layer[] = [
  {
    harmonics: [
      [1, 52, 0.6],
      [2, 24, 2.1],
      [3, 10, 4.2],
    ],
    width: 46,
    opacity: 0.07,
    dur: 132,
    wideOnly: true,
  },
  {
    harmonics: [
      [1, 38, 2.4],
      [3, 17, 0.9],
      [5, 6, 3.3],
    ],
    width: 7,
    opacity: 0.2,
    dur: 78,
  },
  {
    harmonics: [
      [2, 28, 1.2],
      [3, 11, 5.0],
      [7, 4, 2.0],
    ],
    width: 1.4,
    opacity: 0.6,
    dur: 46,
  },
];

export function MarkField({ className = "" }: { className?: string }) {
  const split = MARK_Y / H;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className={`mark-field pointer-events-none absolute inset-0 h-full w-full ${className}`}
      aria-hidden="true"
    >
      <defs>
        {/* Above the mark is dear, below it is cheap. Both stops sit on the
            line, so a path changes colour where it crosses and nowhere else. */}
        <linearGradient
          id="mf-side"
          x1="0"
          y1="0"
          x2="0"
          y2={H}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#ff6b70" />
          <stop offset={split} stopColor="#ff6b70" />
          <stop offset={split} stopColor="#6f9dff" />
          <stop offset="1" stopColor="#6f9dff" />
        </linearGradient>
        <linearGradient id="mf-mark" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.35" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="0.65" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="mf-orb-up">
          <stop offset="0" stopColor="#ff8a8f" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ff8a8f" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mf-orb-down">
          <stop offset="0" stopColor="#8fb3ff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#8fb3ff" stopOpacity="0" />
        </radialGradient>
        {/* Nothing arrives at an edge, it is already gone by then. */}
        <linearGradient id="mf-edge" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" />
          <stop offset="0.16" stopColor="#fff" />
          <stop offset="0.84" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        <mask id="mf-mask">
          <rect width={W} height={H} fill="url(#mf-edge)" />
        </mask>
      </defs>

      <g mask="url(#mf-mask)">
        {/* Two slow lights, breathing in place rather than crossing. */}
        <circle
          cx={W * 0.27}
          cy={MARK_Y - 72}
          r={120}
          fill="url(#mf-orb-up)"
          className="mf-pulse mf-wide"
          style={{ animationDuration: "17s" }}
        />
        <circle
          cx={W * 0.74}
          cy={MARK_Y + 84}
          r={140}
          fill="url(#mf-orb-down)"
          className="mf-pulse mf-wide"
          style={{ animationDuration: "23s", animationDelay: "-8s" }}
        />

        {LAYERS.map((l, i) => (
          <g
            key={i}
            className={`mf-drift${l.wideOnly ? " mf-wide" : ""}`}
            style={{ animationDuration: `${l.dur}s` }}
          >
            <path
              d={pathOf(l.harmonics)}
              fill="none"
              stroke="url(#mf-side)"
              strokeWidth={l.width}
              strokeOpacity={l.opacity}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        ))}

        {/* The mark itself, the one straight thing in the picture. */}
        <line
          x1={0}
          y1={MARK_Y}
          x2={W}
          y2={MARK_Y}
          stroke="url(#mf-mark)"
          strokeWidth={1}
        />
      </g>
    </svg>
  );
}
