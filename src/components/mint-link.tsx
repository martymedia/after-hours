// The mint of a token, linked to the explorer. It says where it goes in
// words: a truncated address is the one thing on the page that a reader
// cannot read, so it cannot be the thing that invites the click. The full
// address still travels in the title, for anyone comparing it to their own.

import { ArrowUpRight } from "lucide-react";
import { shortAddress, solscanToken } from "@/lib/solscan";

export function MintLink({
  mint,
  label = "View on Solscan",
  address = false,
  pill = false,
  dark = false,
  className = "",
}: {
  mint: string;
  label?: string;
  /** Also print the shortened mint, where the address itself is the point. */
  address?: boolean;
  /** A button rather than a run of text. */
  pill?: boolean;
  /** Sitting on one of the black panels rather than on a white card. */
  dark?: boolean;
  className?: string;
}) {
  const look = pill
    ? `pill gap-1.5 ${
        dark
          ? "bg-white/10 text-white hover:bg-white/20"
          : "border-line text-muted hover:text-ink border bg-white"
      }`
    : `inline-flex items-center gap-1 ${
        dark
          ? "text-on-dark-muted hover:text-white"
          : "text-muted-2 hover:text-ink"
      }`;
  return (
    <a
      href={solscanToken(mint)}
      target="_blank"
      rel="noreferrer"
      title={`${mint} on Solscan`}
      className={`transition ${look} ${className}`}
    >
      {label}
      {address && <span className="num opacity-70">{shortAddress(mint)}</span>}
      <ArrowUpRight size={12} strokeWidth={2} />
    </a>
  );
}
