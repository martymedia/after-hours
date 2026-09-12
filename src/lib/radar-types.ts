// Types and labels shared between server (radar.ts) and client components.
// No Node-only imports here: this file ends up in the browser bundle.

import type { IssuerId } from "./issuers.ts";
import type { PhaseInfo, ReferenceLabel } from "./market-phase.ts";

export type Tradability = "easy" | "ok" | "thin" | "stale" | "none";

export const TRADABILITY_LABEL: Record<Tradability, string> = {
  easy: "Easy to trade",
  ok: "Fine for small amounts",
  thin: "Thin market",
  stale: "Price is stale",
  none: "No onchain market",
};

export type RadarRow = {
  underlying: string;
  name: string;
  /** Most liquid token for this stock. */
  mint: string;
  symbol: string;
  issuer: IssuerId;
  issuerName: string;
  price: number | null;
  reference: number | null;
  /** Onchain price vs reference, in percent. */
  gapPct: number | null;
  /** Milliseconds since the last onchain trade (approximate). */
  ageMs: number | null;
  liquidity: number;
  tradability: Tradability;
  /** Number of issuers offering this stock. */
  issuerCount: number;
  spark: number[];
};

export type RadarData = {
  generatedAt: string;
  phase: PhaseInfo;
  liveReference: boolean;
  reference: ReferenceLabel;
  rows: RadarRow[];
};
