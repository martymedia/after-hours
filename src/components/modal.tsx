"use client";

// Centered modal (bottom sheet on phones) with the transitions.dev open and
// close motion, Escape to close, backdrop click to close, scroll lock.

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  ariaLabel: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Tailwind max-width class for the card. */
  width?: string;
};

export function Modal({ ariaLabel, onClose, children, width = "max-w-md" }: Props) {
  const [phase, setPhase] = useState<"init" | "open" | "closing">("init");

  useEffect(() => {
    const id = setTimeout(() => setPhase("open"), 20);
    return () => clearTimeout(id);
  }, []);

  const close = useCallback(() => {
    setPhase("closing");
    setTimeout(onClose, 150);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [close]);

  const cls = phase === "open" ? "is-open" : phase === "closing" ? "is-closing" : "";
  return createPortal(
    <div className={`t-backdrop ${cls} fixed inset-0 z-[90] flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm sm:items-center`} onClick={close} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={(e) => e.stopPropagation()}
        className={`t-modal ${cls} max-h-[92dvh] w-full ${width} overflow-y-auto rounded-3xl bg-card p-5 shadow-2xl`}
      >
        <ModalCloseContext.Provider value={close}>{children}</ModalCloseContext.Provider>
      </div>
    </div>,
    document.body,
  );
}

import { createContext, useContext } from "react";

const ModalCloseContext = createContext<() => void>(() => {});

/** Close the enclosing modal with its exit motion. */
export function useModalClose(): () => void {
  return useContext(ModalCloseContext);
}

/** Round × button for modal headers. */
export function ModalClose() {
  const close = useModalClose();
  return (
    <button type="button" onClick={close} aria-label="Close" className="icon-badge h-8 w-8 shrink-0 hover:bg-soft">
      <span aria-hidden="true" className="text-base leading-none">
        ×
      </span>
    </button>
  );
}
