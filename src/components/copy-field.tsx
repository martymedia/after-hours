"use client";

// A labelled value with a copy button, for addresses people need to paste
// elsewhere. Works on dark and light surfaces.

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyField({
  label,
  value,
  dark = false,
  className = "",
}: {
  label: string;
  value: string;
  dark?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <div
      className={`flex min-w-0 items-center gap-2 rounded-2xl p-3 ${dark ? "bg-white/10" : "bg-soft"} ${className}`}
    >
      <div className="min-w-0 flex-1">
        <div
          className={`text-xs ${dark ? "text-on-dark-muted" : "text-muted"}`}
        >
          {label}
        </div>
        <div className="num mt-0.5 truncate text-xs" title={value}>
          {value}
        </div>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label}`}
        className={`icon-badge h-8 w-8 shrink-0 ${dark ? "border-white/20 bg-transparent text-white hover:bg-white/10" : "hover:bg-line"}`}
      >
        {copied ? (
          <Check size={14} strokeWidth={2} />
        ) : (
          <Copy size={14} strokeWidth={1.75} />
        )}
      </button>
    </div>
  );
}
