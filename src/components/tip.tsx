"use client";

// Hover/focus tooltip rendered through a portal at the body, so cards with
// overflow clipping cannot cut it off. Flips above the trigger when there is
// no room below and stays inside the viewport horizontally.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  text: string;
  children: React.ReactNode;
  className?: string;
  /** Dotted underline on the trigger (for inline words). */
  underline?: boolean;
  /** Bubble colors: dark bubble on light UI, light bubble on dark panels. */
  tone?: "dark" | "light";
};

const WIDTH = 240;

export function Tip({ text, children, className = "", underline = true, tone = "dark" }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean } | null>(null);

  const show = () => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const half = WIDTH / 2;
    const left = Math.min(Math.max(r.left + r.width / 2, half + 8), window.innerWidth - half - 8);
    const above = r.bottom + 110 > window.innerHeight;
    setPos({ left, top: above ? r.top - 8 : r.bottom + 8, above });
  };
  const hide = () => setPos(null);

  useEffect(() => {
    if (!pos) return;
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, [pos]);

  return (
    <>
      <span
        ref={ref}
        tabIndex={0}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className={`inline-flex cursor-help outline-none ${
          underline ? "underline decoration-dotted decoration-[color:var(--muted-2)] underline-offset-4" : ""
        } ${className}`}
      >
        {children}
      </span>
      {pos &&
        createPortal(
          <span
            role="tooltip"
            style={{ position: "fixed", left: pos.left, top: pos.top, width: WIDTH, transform: pos.above ? "translate(-50%, -100%)" : "translateX(-50%)" }}
            className={`pointer-events-none z-[100] rounded-xl px-3 py-2 text-left text-xs leading-relaxed font-normal shadow-lg ${
              tone === "dark" ? "bg-ink text-white" : "bg-white text-ink"
            }`}
          >
            {text}
          </span>,
          document.body,
        )}
    </>
  );
}
