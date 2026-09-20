// The mint of a token, linked to the explorer. It carries the address in
// full in its title and shortened on screen, because the address is the one
// piece of information that tells a reader they are looking at the token
// they think they are looking at.

import { ArrowUpRight } from "lucide-react";
import { shortAddress, solscanToken } from "@/lib/solscan";

export function MintLink({
  mint,
  label,
  dark = false,
  className = "",
}: {
  mint: string;
  /** Overrides the shortened address, for places that need words instead. */
  label?: string;
  /** Sitting on one of the black panels rather than on a white card. */
  dark?: boolean;
  className?: string;
}) {
  return (
    <a
      href={solscanToken(mint)}
      target="_blank"
      rel="noreferrer"
      title={`${mint} on Solscan`}
      className={`num inline-flex items-center gap-1 transition ${
        dark
          ? "text-on-dark-muted hover:text-white"
          : "text-muted-2 hover:text-ink"
      } ${className}`}
    >
      {label ?? shortAddress(mint)}
      <ArrowUpRight size={12} strokeWidth={2} />
    </a>
  );
}
