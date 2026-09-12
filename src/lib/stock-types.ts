import type { IssuerId } from "./issuers.ts";
import type { PhaseInfo, ReferenceLabel } from "./market-phase.ts";
import type { Tradability } from "./radar-types.ts";

export type StockToken = {
  mint: string;
  symbol: string;
  issuer: IssuerId;
  issuerName: string;
  structure: string;
  structureShort: string;
  decimals: number;
  price: number | null;
  reference: number | null;
  gapPct: number | null;
  ageMs: number | null;
  liquidity: number;
  tradability: Tradability;
};

export type StockData = {
  generatedAt: string;
  underlying: string;
  name: string;
  phase: PhaseInfo;
  liveReference: boolean;
  reference: ReferenceLabel;
  primary: StockToken;
  tokens: StockToken[];
  candles: { ts: number; close: number }[];
  nextEarnings: { date: string; timing: string } | null;
};

export type CostEstimate = {
  usd: number;
  shares: number;
  /** Effective price per share for this size. */
  execPrice: number;
  /** Onchain mid price before impact. */
  onchainPrice: number | null;
  reference: number | null;
  /** How far the effective price sits from the reference, in percent. */
  vsReferencePct: number | null;
  /** Price impact of this size on the pool, in percent. */
  impactPct: number;
  route: string[];
};
