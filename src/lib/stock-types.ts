import type { IssuerId } from "./issuers.ts";
import type { PhaseInfo, ReferenceLabel } from "./market-phase.ts";
import type { RadarRow, Tradability } from "./radar-types.ts";
import type { Sector } from "./companies.ts";

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

export type GapPoint = { ts: number; gapPct: number };

export type StockData = {
  generatedAt: string;
  underlying: string;
  name: string;
  description: string;
  sector: Sector;
  phase: PhaseInfo;
  liveReference: boolean;
  reference: ReferenceLabel;
  primary: StockToken;
  tokens: StockToken[];
  candles: { ts: number; close: number }[];
  /** Onchain vs reference over the last 48 hours, one point per 15 minutes. */
  gapSeries: GapPoint[];
  /** Other tracked stocks in the same sector. */
  similar: RadarRow[];
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
