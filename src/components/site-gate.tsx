"use client";

// What a first-time visitor has to read before using the site.
//
// The wording only claims what is actually ours to claim. We do not issue
// these tokens, we hold no funds, we run no terms of service and we have no
// power to freeze or reverse anything, so none of that appears here. The
// issuers do have their own agreements, and where a statement belongs to
// them we point at them rather than restating their terms as if they were
// ours.
//
// The page underneath stays in the DOM the whole time. The gate is mounted
// on the client only, so a crawler is served the full page and nothing here
// affects what gets indexed.

import { useEffect, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { REPO_URL } from "@/lib/brand";

/** Bump when the wording changes, so everyone reads the new version once. */
const KEY = "ah:agreed:1";

// Whether this reader has agreed lives outside React: it is a fact about the
// browser, not state we own. Reading it in an effect and calling setState is
// what the compiler rules rightly forbid, and an external store is the shape
// this actually is.
let listeners: (() => void)[] = [];
const subscribe = (fn: () => void) => {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
};
function readAgreed(): "yes" | "no" {
  try {
    return localStorage.getItem(KEY) === "yes" ? "yes" : "no";
  } catch {
    // Storage blocked is a reason to ask, not a reason to fail open.
    return "no";
  }
}
/** The server renders nothing, so the HTML a crawler gets is the page. */
const serverAgreed = () => "yes" as const;
function setAgreed() {
  try {
    localStorage.setItem(KEY, "yes");
  } catch {
    // Not remembering it is better than not letting anyone in.
  }
  for (const l of listeners) l();
}

const TERMS = [
  <>
    After Hours is a <strong>screener with a buy button</strong>. Trades are
    signed in your own wallet and routed through Jupiter. We never hold your
    funds, we cannot move them, and we cannot reverse a transaction you sign.
    Onchain trades are final.
  </>,
  <>
    We do not issue any token listed here. They come from xStocks, Backpack and
    PreStocks, who each set their own terms. A tokenized stock or pre-IPO token
    is <strong>not a share</strong>: no ownership, no voting, no dividend, no
    information rights.
  </>,
  <>
    Prices, marks and closing references come from third parties. We measure
    the distance between them and show our working, but we do not guarantee any
    number on this page, and nothing here is investment advice.
  </>,
  <>
    This is <strong>early software</strong>, served as is. Features can change,
    things can break, and liquidity for these tokens is not guaranteed by
    anyone.
  </>,
  <>
    You are of legal age and not a US person, and using this is lawful where
    you are.
  </>,
];

export function SiteGate() {
  const agreed = useSyncExternalStore(subscribe, readAgreed, serverAgreed);
  const open = agreed === "no";
  const accept = useRef<HTMLButtonElement>(null);

  // While it is up, the page behind it does not scroll away underneath.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    accept.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gate-title"
      className="bg-ink/70 fixed inset-0 z-[100] flex items-end justify-center p-4 backdrop-blur-sm sm:items-center"
    >
      <div className="card flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col p-6 shadow-xl sm:p-8">
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="icon-badge bg-soft-warn text-warn h-8 w-8 border-0">
            <AlertTriangle size={15} strokeWidth={2} />
          </span>
          <h2 id="gate-title" className="text-xl font-semibold tracking-tight">
            Before you go in
          </h2>
        </div>

        <ul className="-mr-2 mt-5 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-2">
          {TERMS.map((t, i) => (
            <li key={i} className="text-muted flex gap-3 text-sm leading-relaxed">
              <span className="bg-blue mt-2 h-1.5 w-1.5 shrink-0 rounded-full" />
              <span>{t}</span>
            </li>
          ))}
        </ul>

        <p className="text-muted-2 mt-5 shrink-0 text-xs leading-relaxed">
          Every quote, fee and transaction in this app is readable in the{" "}
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="hover:text-ink underline underline-offset-2"
          >
            source
          </a>
          , and{" "}
          <Link href="/how" className="hover:text-ink underline underline-offset-2">
            How it works
          </Link>{" "}
          explains where each number comes from. If you do not agree with all of
          the above, please close this tab.
        </p>

        <button
          ref={accept}
          type="button"
          onClick={setAgreed}
          className="btn mt-5 w-full shrink-0"
        >
          I understand, let me in
          <ArrowUpRight size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
