// Issuer metadata. The structure label matters: only same-structure tokens
// are directly comparable, and a beginner deserves to know what they hold.

export type IssuerId = "xstocks" | "backpack" | "prestocks" | "tessera" | "ondo";

export type IssuerInfo = {
  id: IssuerId;
  name: string;
  /** Plain-language description of what the token legally is. */
  structure: string;
  structureShort: string;
  /** Jupiter tag that identifies the issuer. */
  tag: string;
  /** Search queries that surface this issuer's tokens on Jupiter. */
  searchQueries: string[];
  /** Listed public companies only in v1: pre-IPO tokens have no Wall Street
   *  price to compare against, so a "difference" would mislead. */
  enabled: boolean;
};

export const ISSUERS: Record<IssuerId, IssuerInfo> = {
  xstocks: {
    id: "xstocks",
    name: "xStocks",
    structure:
      "Tracker certificate issued by Backed (Switzerland), backed 1:1 by shares held with a custodian. Dividends arrive as USDC.",
    structureShort: "Tracker, 1:1 backed",
    tag: "xstocks",
    searchQueries: [],
    enabled: true,
  },
  backpack: {
    id: "backpack",
    name: "Backpack",
    structure:
      "Real share held by Backpack Securities, a US broker-dealer. Redeemable into the actual stock for onboarded holders.",
    structureShort: "Real share, redeemable",
    tag: "backpack",
    searchQueries: ["Backpack Securities"],
    enabled: true,
  },
  prestocks: {
    id: "prestocks",
    name: "PreStocks",
    structure:
      "Synthetic exposure to a private company via an SPV. No enforceable claim on shares. Higher risk.",
    structureShort: "Synthetic pre-IPO",
    tag: "prestocks",
    searchQueries: ["PreStocks"],
    enabled: false,
  },
  tessera: {
    id: "tessera",
    name: "Tessera",
    structure: "Tokenized exposure to a private company. Check the issuer's terms before trading.",
    structureShort: "Pre-IPO exposure",
    tag: "tessera",
    searchQueries: ["Tessera", "T-"],
    enabled: false,
  },
  ondo: {
    id: "ondo",
    name: "Ondo",
    structure:
      "Structured note backed 1:1 by shares at a US broker-dealer. Mint and redeem through Ondo only, no onchain pools.",
    structureShort: "Note, no onchain liquidity",
    tag: "ondo",
    searchQueries: ["Ondo Tokenized"],
    enabled: true,
  },
};

export const ISSUER_ORDER: IssuerId[] = ["xstocks", "backpack", "prestocks", "tessera", "ondo"];

export function issuerFromTags(tags: string[] | undefined): IssuerId | null {
  if (!tags) return null;
  for (const id of ISSUER_ORDER) {
    if (tags.includes(ISSUERS[id].tag)) return id;
  }
  return null;
}
