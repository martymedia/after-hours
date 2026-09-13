"use client";

// Small motion primitives adapted from transitions.dev (MIT-style recipes,
// see docs/MOTION.md). Each one owns its DOM hooks; the CSS lives in
// globals.css under "Motion". All of them respect prefers-reduced-motion.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const reduceMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------------------------------------------------------------- */
/* Tabs sliding: a segmented control whose pill follows the active option. */

type SegOption<T extends string> = { id: T; label: string };

export function Seg<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = "",
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  const bar = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const first = useRef(true);

  const move = useCallback(
    (animate: boolean) => {
      const b = bar.current;
      const p = pill.current;
      if (!b || !p) return;
      const active = b.querySelector<HTMLButtonElement>('button[aria-selected="true"]');
      if (!active) return;
      if (!animate) p.style.transition = "none";
      p.style.transform = `translateX(${active.offsetLeft}px)`;
      p.style.width = `${active.offsetWidth}px`;
      if (!animate) {
        void p.offsetWidth;
        p.style.transition = "";
      }
    },
    [],
  );

  useLayoutEffect(() => {
    move(!first.current);
    first.current = false;
  }, [value, move]);

  useEffect(() => {
    const b = bar.current;
    if (!b) return;
    const ro = new ResizeObserver(() => move(false));
    ro.observe(b);
    return () => ro.disconnect();
  }, [move]);

  return (
    <div ref={bar} className={`t-tabs seg ${className}`} role="tablist" aria-label={ariaLabel}>
      <span ref={pill} className="t-tabs-pill" aria-hidden="true" />
      {options.map((o) => (
        <button key={o.id} type="button" role="tab" aria-selected={value === o.id} className="t-tab" onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Text states swap: old text exits up with blur, new text enters from below. */

export function SwapText({ text, className = "" }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(text);
  const mounted = useRef(false);

  // Phase 1: the old text exits, then the displayed text changes.
  useEffect(() => {
    if (display === text) return;
    const el = ref.current;
    if (!el || reduceMotion()) {
      const id = setTimeout(() => setDisplay(text), 0);
      return () => clearTimeout(id);
    }
    el.classList.add("is-exit");
    const id = setTimeout(() => setDisplay(text), 150);
    return () => clearTimeout(id);
  }, [text, display]);

  // Phase 2: the new text jumps below and eases back to rest.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    el.classList.remove("is-exit");
    el.classList.add("is-enter-start");
    void el.offsetHeight;
    el.classList.remove("is-enter-start");
  }, [display]);

  return (
    <span ref={ref} className={`t-text-swap ${className}`} data-text={display}>
      {display}
    </span>
  );
}

/* ---------------------------------------------------------------------- */
/* Number pop-in: digits re-enter with blur when the value changes.        */

export function PopNumber({ value, format, className = "" }: { value: number | null; format: (n: number) => string; className?: string }) {
  const text = value == null ? "–" : format(value);
  // Derived state: bump the key whenever the formatted text changes, so
  // the first render never animates and every later change replays.
  const [seen, setSeen] = useState({ text, count: 0 });
  if (seen.text !== text) setSeen({ text, count: seen.count + 1 });
  const animKey = seen.text === text ? seen.count : seen.count + 1;

  const chars = text.split("");
  return (
    <span key={animKey} className={`t-digit-group ${animKey > 0 ? "is-animating" : ""} ${className}`}>
      {chars.map((ch, i) => (
        <span key={i} className="t-digit" data-stagger={i === chars.length - 2 ? "1" : i === chars.length - 1 ? "2" : undefined}>
          {ch}
        </span>
      ))}
    </span>
  );
}

/* ---------------------------------------------------------------------- */
/* Success check: fade, rotate upright, bob, blur off, and draw the stroke. */

export function SuccessCheck({ size = 22, className = "" }: { size?: number; className?: string }) {
  const [state, setState] = useState<"out" | "in">("out");
  useEffect(() => {
    const id = setTimeout(() => setState("in"), 20);
    return () => clearTimeout(id);
  }, []);
  return (
    <span className={`t-success-check ${className}`} data-state={state} aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5 L10 17.5 L19 7.5" pathLength="1" />
      </svg>
    </span>
  );
}

/* ---------------------------------------------------------------------- */
/* Texts reveal: children lines rise with a stagger once mounted.          */

export function StaggerReveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // setTimeout, not requestAnimationFrame: rAF never fires in a hidden tab.
    const id = setTimeout(() => el.classList.add("is-shown"), 20);
    return () => clearTimeout(id);
  }, []);
  return (
    <div ref={ref} className={`t-stagger ${className}`}>
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Card hover tilt: the outer wrapper tracks the pointer, the card rotates. */

const TILT_MAX = 7;

export function Tilt({ children, className = "", cardClassName = "" }: { children: React.ReactNode; className?: string; cardClassName?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);

  const reset = useCallback(() => {
    wrap.current?.classList.remove("is-hover");
    const c = card.current;
    if (!c) return;
    c.classList.remove("is-tilting");
    c.style.setProperty("--tilt-rx", "0deg");
    c.style.setProperty("--tilt-ry", "0deg");
  }, []);

  const track = useCallback((e: React.PointerEvent) => {
    if (reduceMotion() || e.pointerType !== "mouse") return;
    const w = wrap.current;
    const c = card.current;
    if (!w || !c) return;
    const r = w.getBoundingClientRect();
    const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    w.classList.add("is-hover");
    c.classList.add("is-tilting");
    c.style.setProperty("--tilt-ry", `${((px - 0.5) * TILT_MAX).toFixed(2)}deg`);
    c.style.setProperty("--tilt-rx", `${((0.5 - py) * TILT_MAX).toFixed(2)}deg`);
    c.style.setProperty("--tilt-gx", `${(px * 100).toFixed(1)}%`);
    c.style.setProperty("--tilt-gy", `${(py * 100).toFixed(1)}%`);
  }, []);

  return (
    <div ref={wrap} className={`t-tilt ${className}`} onPointerMove={track} onPointerLeave={reset} onPointerCancel={reset}>
      <div ref={card} className={`t-tilt-card ${cardClassName}`}>
        {children}
        <span className="t-tilt-glare" aria-hidden="true" />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Sliding indicator for the phone tab bar: a pill behind the active icon. */

export function useSlidingPill(active: string | null, deps: unknown[] = []) {
  const bar = useRef<HTMLElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const first = useRef(true);
  useLayoutEffect(() => {
    const b = bar.current;
    const p = pill.current;
    if (!b || !p) return;
    const target = active ? b.querySelector<HTMLElement>(`[data-pill-target="${active}"]`) : null;
    if (!target) {
      p.style.opacity = "0";
      return;
    }
    const br = b.getBoundingClientRect();
    const tr = target.getBoundingClientRect();
    const animate = !first.current && !reduceMotion();
    if (!animate) p.style.transition = "none";
    p.style.opacity = "1";
    p.style.transform = `translate(${tr.left - br.left}px, ${tr.top - br.top}px)`;
    p.style.width = `${tr.width}px`;
    p.style.height = `${tr.height}px`;
    if (!animate) {
      void p.offsetWidth;
      p.style.transition = "";
    }
    first.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ...deps]);
  return { bar, pill };
}
