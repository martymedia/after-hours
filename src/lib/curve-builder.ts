// Curve builder: a Meteora DBC configuration for a token quoted in a
// tokenized stock, anchored to the real Wall Street print. The user thinks
// in USD (starting market cap, graduation market cap); we convert through
// the stock's current onchain price, so the curve starts and graduates at
// values that mean something in dollars, and the SDK's own validation runs
// before anything is shown. Creating the config and pool is one
// transaction, signed by the user's wallet; the two fresh keypairs (config
// and launch mint) are generated here and co-sign server-side.

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  ActivationType,
  BaseFeeMode,
  CollectFeeMode,
  DynamicBondingCurveClient,
  MigrationFeeOption,
  MigrationOption,
  TokenDecimal,
  TokenType,
  TokenAuthorityOption,
  buildCurveWithMarketCap,
  validateConfigParameters,
  deriveTokenBadgeAddress,
  deriveDbcPoolAddress,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import { SITE_URL } from "./brand.ts";
import { latestSnapshots, listTokens } from "./db.ts";
import { effectiveMultiplier, getPrices } from "./jupiter.ts";

const RPC_URL =
  process.env.SOLANA_RPC_SERVER_URL ??
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
  "https://api.mainnet-beta.solana.com";

export type CurveInput = {
  stockMint: string;
  supply: number;
  initialMcapUsd: number;
  migrationMcapUsd: number;
  startFeeBps: number;
  endFeeBps: number;
  feeMinutes: number;
  creatorFeePct: number;
};

export type CurvePreview = {
  stock: {
    mint: string;
    symbol: string;
    name: string;
    decimals: number;
    price: number;
    badged: boolean;
  };
  input: CurveInput;
  startPriceUsd: number;
  migrationPriceUsd: number;
  /** Quote the curve must collect before it graduates, in stock units and USD. */
  thresholdQuote: number;
  thresholdUsd: number;
  /** Share of supply sold on the curve before migration. */
  soldShare: number;
  fee: {
    startBps: number;
    endBps: number;
    minutes: number;
    afterBps: number;
    creatorPct: number;
  };
  warnings: string[];
  /** The SDK config parameters, JSON-safe (big numbers as decimal strings). */
  params: Record<string, unknown>;
};

export const LIMITS = {
  supply: { min: 1_000_000, max: 1_000_000_000_000 },
  initialMcapUsd: { min: 500, max: 10_000_000 },
  migrationMcapUsd: { min: 5_000, max: 100_000_000 },
  feeBps: { min: 25, max: 9_900 },
  feeMinutes: { min: 1, max: 24 * 60 },
  creatorFeePct: { min: 0, max: 100 },
};

function clampInput(raw: Partial<CurveInput>): CurveInput {
  const n = (v: unknown, d: number, min: number, max: number) => {
    const x = Number(v);
    return Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : d;
  };
  return {
    stockMint: String(raw.stockMint ?? ""),
    supply: Math.round(
      n(raw.supply, 1_000_000_000, LIMITS.supply.min, LIMITS.supply.max),
    ),
    initialMcapUsd: n(
      raw.initialMcapUsd,
      5_000,
      LIMITS.initialMcapUsd.min,
      LIMITS.initialMcapUsd.max,
    ),
    migrationMcapUsd: n(
      raw.migrationMcapUsd,
      50_000,
      LIMITS.migrationMcapUsd.min,
      LIMITS.migrationMcapUsd.max,
    ),
    startFeeBps: Math.round(
      n(raw.startFeeBps, 500, LIMITS.feeBps.min, LIMITS.feeBps.max),
    ),
    endFeeBps: Math.round(
      n(raw.endFeeBps, 100, LIMITS.feeBps.min, LIMITS.feeBps.max),
    ),
    feeMinutes: Math.round(
      n(raw.feeMinutes, 60, LIMITS.feeMinutes.min, LIMITS.feeMinutes.max),
    ),
    creatorFeePct: Math.round(
      n(
        raw.creatorFeePct,
        50,
        LIMITS.creatorFeePct.min,
        LIMITS.creatorFeePct.max,
      ),
    ),
  };
}

const jsonSafe = (v: unknown): unknown =>
  JSON.parse(
    JSON.stringify(v, (_k, x) => {
      if (
        x &&
        typeof x === "object" &&
        typeof (x as { toString?: unknown }).toString === "function"
      ) {
        const ctor = (x as { constructor?: { name?: string } }).constructor
          ?.name;
        if (ctor === "BN")
          return (x as { toString(r: number): string }).toString(10);
        if (ctor === "PublicKey")
          return (x as { toBase58(): string }).toBase58();
      }
      return x;
    }),
  );

let client: DynamicBondingCurveClient | null = null;
function dbc(): DynamicBondingCurveClient {
  if (client) return client;
  const connection = new Connection(RPC_URL, {
    commitment: "confirmed",
    httpHeaders: RPC_URL.includes("helius") ? { Origin: SITE_URL } : undefined,
  });
  client = new DynamicBondingCurveClient(connection, "confirmed");
  return client;
}

async function stockFor(mint: string) {
  const token = listTokens().find((t) => t.mint === mint);
  if (!token) throw new Error("unknown stock");
  const snap = latestSnapshots().find((s) => s.mint === mint);
  let price = snap?.usd_price ?? null;
  if (price == null) {
    const p = (await getPrices([mint]))[mint];
    price = p?.usdPrice ?? null;
    void effectiveMultiplier(p);
  }
  if (price == null || price <= 0)
    throw new Error("no onchain price for this stock right now");
  const badge = await dbc().state.getTokenBadge(new PublicKey(mint));
  return {
    mint,
    symbol: token.symbol,
    name: token.name,
    decimals: token.decimals,
    price,
    badged: Boolean(badge),
  };
}

function decimalEnum(d: number): TokenDecimal {
  if (d === 6) return TokenDecimal.SIX;
  if (d === 7) return TokenDecimal.SEVEN;
  if (d === 9) return TokenDecimal.NINE;
  return TokenDecimal.EIGHT;
}

function build(input: CurveInput, stock: Awaited<ReturnType<typeof stockFor>>) {
  const periods = Math.max(1, Math.min(120, input.feeMinutes));
  return buildCurveWithMarketCap({
    token: {
      tokenType: TokenType.SPLToken,
      tokenBaseDecimal: TokenDecimal.SIX,
      tokenQuoteDecimal: decimalEnum(stock.decimals),
      tokenAuthorityOption: TokenAuthorityOption.Immutable,
      totalTokenSupply: input.supply,
      leftover: 0,
    },
    fee: {
      baseFeeParams: {
        baseFeeMode: BaseFeeMode.FeeSchedulerExponential,
        feeSchedulerParam:
          input.startFeeBps === input.endFeeBps
            ? {
                startingFeeBps: input.startFeeBps,
                endingFeeBps: input.endFeeBps,
                numberOfPeriod: 0,
                totalDuration: 0,
              }
            : {
                startingFeeBps: input.startFeeBps,
                endingFeeBps: input.endFeeBps,
                numberOfPeriod: periods,
                totalDuration: input.feeMinutes * 60,
              },
      },
      dynamicFeeEnabled: true,
      collectFeeMode: CollectFeeMode.QuoteToken,
      creatorTradingFeePercentage: input.creatorFeePct,
      poolCreationFee: 0,
      enableFirstSwapWithMinFee: false,
    },
    migration: {
      migrationOption: MigrationOption.MET_DAMM_V2,
      migrationFeeOption: MigrationFeeOption.FixedBps100,
      migrationFee: { feePercentage: 0, creatorFeePercentage: 0 },
    },
    liquidityDistribution: {
      partnerPermanentLockedLiquidityPercentage: 50,
      partnerLiquidityPercentage: 0,
      creatorPermanentLockedLiquidityPercentage: 50,
      creatorLiquidityPercentage: 0,
    },
    lockedVesting: {
      totalLockedVestingAmount: 0,
      numberOfVestingPeriod: 0,
      cliffUnlockAmount: 0,
      totalVestingDuration: 0,
      cliffDurationFromMigrationTime: 0,
    },
    activationType: ActivationType.Timestamp,
    initialMarketCap: input.initialMcapUsd / stock.price,
    migrationMarketCap: input.migrationMcapUsd / stock.price,
  });
}

export async function previewCurve(
  raw: Partial<CurveInput>,
): Promise<CurvePreview> {
  const input = clampInput(raw);
  if (input.migrationMcapUsd <= input.initialMcapUsd * 1.5)
    input.migrationMcapUsd = input.initialMcapUsd * 1.5;
  if (input.endFeeBps > input.startFeeBps) input.endFeeBps = input.startFeeBps;
  const stock = await stockFor(input.stockMint);
  const params = build(input, stock);
  const probe = Keypair.generate().publicKey;
  validateConfigParameters({
    ...params,
    leftoverReceiver: probe,
    feeClaimer: probe,
    quoteMint: new PublicKey(stock.mint),
    payer: probe,
    config: probe,
  } as never);

  const thresholdQuote =
    Number(params.migrationQuoteThreshold.toString()) / 10 ** stock.decimals;
  const soldShare = 0; // the SDK does not expose the migration base threshold here
  const warnings: string[] = [];
  if (!stock.badged)
    warnings.push(
      `${stock.symbol} has no DBC token badge yet, so Meteora will reject it as a quote token. Pick a badged stock.`,
    );
  if (input.startFeeBps > 2000)
    warnings.push(
      "A starting fee above 20% keeps everyone out, not only snipers.",
    );
  if (input.migrationMcapUsd / input.initialMcapUsd > 100)
    warnings.push(
      "Graduating at more than 100x the starting cap makes the curve very steep.",
    );
  return {
    stock,
    input,
    // By construction: market cap over supply, in dollars.
    startPriceUsd: input.initialMcapUsd / input.supply,
    migrationPriceUsd: input.migrationMcapUsd / input.supply,
    thresholdQuote,
    thresholdUsd: thresholdQuote * stock.price,
    soldShare: Number.isFinite(soldShare)
      ? Math.max(0, Math.min(1, soldShare))
      : 0,
    fee: {
      startBps: input.startFeeBps,
      endBps: input.endFeeBps,
      minutes: input.feeMinutes,
      afterBps: 100,
      creatorPct: input.creatorFeePct,
    },
    warnings,
    params: jsonSafe(params) as Record<string, unknown>,
  };
}

export type CreateResult = {
  transaction: string;
  config: string;
  baseMint: string;
  pool: string;
  symbol: string;
};

/** One transaction: create the config and initialise its pool. The payer signs in the wallet. */
export async function buildCreateTransaction(
  raw: Partial<CurveInput> & { name: string; symbol: string; uri?: string },
  payer: string,
): Promise<CreateResult> {
  const preview = await previewCurve(raw);
  if (!preview.stock.badged)
    throw new Error("this stock is not badged as a DBC quote token");
  const name = raw.name.trim().slice(0, 32);
  const symbol = raw.symbol
    .trim()
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 10)
    .toUpperCase();
  if (name.length < 2 || symbol.length < 2)
    throw new Error("name and symbol are required");
  const uri = (raw.uri ?? "").trim() || `${SITE_URL}/curves`;
  const stock = preview.stock;
  const params = build(preview.input, stock);
  const owner = new PublicKey(payer);
  const config = Keypair.generate();
  const baseMint = Keypair.generate();
  const c = dbc();
  const tx = await c.partner.createConfigAndPool({
    ...params,
    config: config.publicKey,
    feeClaimer: owner,
    leftoverReceiver: owner,
    quoteMint: new PublicKey(stock.mint),
    payer: owner,
    tokenBadge: deriveTokenBadgeAddress(new PublicKey(stock.mint)),
    preCreatePoolParam: {
      name,
      symbol,
      uri,
      poolCreator: owner,
      baseMint: baseMint.publicKey,
    },
  } as never);
  const { blockhash } = await c.connection.getLatestBlockhash("confirmed");
  tx.feePayer = owner;
  tx.recentBlockhash = blockhash;
  tx.partialSign(config, baseMint);
  const wire = tx.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });
  const pool = deriveDbcPoolAddress(
    new PublicKey(stock.mint),
    baseMint.publicKey,
    config.publicKey,
  );
  return {
    transaction: Buffer.from(wire).toString("base64"),
    config: config.publicKey.toBase58(),
    baseMint: baseMint.publicKey.toBase58(),
    pool: pool.toBase58(),
    symbol,
  };
}
