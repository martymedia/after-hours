// Credit for whoever issues the tokens on the surface you are looking at,
// linked to their own site. We measure the distance to their mark, so saying
// whose mark it is belongs next to the claim, not in a footnote.

import { ArrowUpRight } from "lucide-react";
import { ISSUERS, type IssuerId } from "@/lib/issuers";

export function PoweredBy({
  issuer = "prestocks",
  dark = true,
}: {
  issuer?: IssuerId;
  /** Sitting on one of the black panels rather than on a white card. */
  dark?: boolean;
}) {
  const info = ISSUERS[issuer];
  if (!info?.url) return null;
  return (
    <a
      href={info.url}
      target="_blank"
      rel="noreferrer"
      className={`pill gap-1.5 transition ${
        dark
          ? "bg-white/10 text-white hover:bg-white/20"
          : "border-line text-muted hover:text-ink border bg-white"
      }`}
    >
      Powered by <span className="font-semibold">{info.name}</span>
      <ArrowUpRight size={12} strokeWidth={2} />
    </a>
  );
}
