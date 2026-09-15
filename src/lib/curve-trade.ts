// Taking part in a stock-quoted bonding curve: quote a buy or a sell on
// the curve, build the swap transaction for the user's wallet, and let the
// creator claim trading fees. Server-side; the wallet signs in the browser.

import { Connection, PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  DynamicBondingCurveClient,
  getCurrentPoint,
  swapQuote,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import { SITE_URL } from "./brand.ts";
import { latestSnapshots, listTokens } from "./db.ts";
import { rawBalance } from "./wallet.ts";

const RPC_URL =
  process.env.SOLANA_RPC_SERVER_URL ??
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
  "https://api.mainnet-beta.solana.com";
const SLIPPAGE_BPS = 100;

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

type PoolState = {
  config: PublicKey;
  baseMint: PublicKey;
  creator: PublicKey;
  isMigrated: number;
  activationPoint: BN;
  quoteReserve: BN;
  sqrtPrice: BN;
};

async function loadPool(pool: string) {
  const c = dbc();
  const fetched = (await c.state.getPool(pool)) as unknown as
    { poolState?: PoolState } | PoolState | null;
  if (!fetched) throw new Error("pool not found");
  const state = ((fetched as { poolState?: PoolState }).poolState ??
    fetched) as PoolState;
  const config = await c.state.getPoolConfig(state.config);
  if (!config) throw new Error("pool config not found");
  const quoteMint = config.quoteMint.toBase58();
  const stock = listTokens().find((t) => t.mint === quoteMint);
  if (!stock) throw new Error("quote token is not a stock we track");
  const price =
    latestSnapshots().find((s) => s.mint === quoteMint)?.usd_price ?? null;
  return { c, fetched, state, config, stock, price };
}

export type CurveQuote = {
  side: "buy" | "sell";
  /** What goes in and what comes out, in UI units. */
  amountIn: number;
  amountOut: number;
  minimumOut: number;
  /** Trading fee taken on the way, in quote units. */
  feeQuote: number;
  quoteSymbol: string;
  quoteDecimals: number;
  baseDecimals: number;
  stockPrice: number | null;
  migrated: boolean;
  /** Progress the curve would reach after this buy, 0..1. */
  progressAfter: number | null;
};

/** amount: quote units for a buy (stock tokens), base units for a sell (launch tokens). */
export async function quoteCurve(
  pool: string,
  side: "buy" | "sell",
  amount: number,
): Promise<CurveQuote> {
  const { c, fetched, state, config, stock, price } = await loadPool(pool);
  if (state.isMigrated)
    throw new Error("this curve has graduated; trade it on the open pool");
  const qDec = stock.decimals;
  const bDec = config.tokenDecimal;
  const amountIn = new BN(
    Math.floor(amount * 10 ** (side === "buy" ? qDec : bDec)).toString(),
  );
  if (amountIn.lten(0)) throw new Error("amount too small");
  const currentPoint = await getCurrentPoint(
    c.connection,
    config.activationType,
  );
  // The SDK types this through Anchor's IDL helpers, which our TS setup
  // cannot resolve; the runtime object carries these three fields.
  const q = swapQuote(
    fetched as never,
    config,
    side === "sell",
    amountIn,
    SLIPPAGE_BPS,
    false,
    currentPoint,
    false,
  ) as unknown as { outputAmount: BN; tradingFee: BN; minimumAmountOut: BN };
  const outDec = side === "buy" ? bDec : qDec;
  const fee =
    Number(q.tradingFee.toString()) / 10 ** (side === "buy" ? qDec : bDec);
  const threshold = Number(config.migrationQuoteThreshold.toString());
  const reserve = Number(state.quoteReserve.toString());
  const progressAfter =
    threshold > 0 && side === "buy"
      ? Math.min(1, (reserve + Number(amountIn.toString())) / threshold)
      : null;
  return {
    side,
    amountIn: amount,
    amountOut: Number(q.outputAmount.toString()) / 10 ** outDec,
    minimumOut: Number(q.minimumAmountOut.toString()) / 10 ** outDec,
    feeQuote:
      side === "buy"
        ? fee
        : fee *
          (Number(q.outputAmount.toString()) /
            Math.max(1, Number(amountIn.toString()))),
    quoteSymbol: stock.symbol,
    quoteDecimals: qDec,
    baseDecimals: bDec,
    stockPrice: price,
    migrated: false,
    progressAfter,
  };
}

/** The swap transaction, unsigned; the wallet pays and signs. Sells are clamped to the wallet's balance. */
export async function buildCurveSwap(
  pool: string,
  side: "buy" | "sell",
  amount: number,
  owner: string,
): Promise<{ transaction: string; quote: CurveQuote }> {
  const { c, state, config, stock } = await loadPool(pool);
  const qDec = stock.decimals;
  const bDec = config.tokenDecimal;
  const ownerKey = new PublicKey(owner);
  let amountIn = new BN(
    Math.floor(amount * 10 ** (side === "buy" ? qDec : bDec)).toString(),
  );
  const mint = side === "buy" ? stock.mint : state.baseMint.toBase58();
  const balance = await rawBalance(owner, mint);
  if (balance != null) {
    const bal = new BN(balance.toString());
    if (amountIn.gt(bal)) {
      if (amountIn.gt(bal.muln(102).divn(100)))
        throw new Error(
          side === "buy"
            ? `not enough ${stock.symbol} in the wallet`
            : "not enough of the token in the wallet",
        );
      amountIn = bal;
    }
  }
  const uiIn =
    Number(amountIn.toString()) / 10 ** (side === "buy" ? qDec : bDec);
  const quote = await quoteCurve(pool, side, uiIn);
  const minimumAmountOut = new BN(
    Math.floor(
      quote.minimumOut * 10 ** (side === "buy" ? bDec : qDec),
    ).toString(),
  );
  const tx = await c.pool.swap({
    owner: ownerKey,
    pool: new PublicKey(pool),
    amountIn,
    minimumAmountOut,
    swapBaseForQuote: side === "sell",
    referralTokenAccount: null,
    payer: ownerKey,
  });
  const { blockhash } = await c.connection.getLatestBlockhash("confirmed");
  tx.feePayer = ownerKey;
  tx.recentBlockhash = blockhash;
  const wire = tx.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });
  return { transaction: Buffer.from(wire).toString("base64"), quote };
}

export type CreatorFees = {
  pool: string;
  creator: string;
  quoteFee: number;
  baseFee: number;
  quoteSymbol: string;
};

export async function creatorFees(pool: string): Promise<CreatorFees> {
  const { c, state, config, stock } = await loadPool(pool);
  const m = await c.state.getPoolFeeMetrics(pool);
  return {
    pool,
    creator: state.creator.toBase58(),
    quoteFee:
      Number(m.current.creatorQuoteFee.toString()) / 10 ** stock.decimals,
    baseFee:
      Number(m.current.creatorBaseFee.toString()) / 10 ** config.tokenDecimal,
    quoteSymbol: stock.symbol,
  };
}

/** Claim every unclaimed creator fee of a pool; only the pool's creator can sign it. */
export async function buildClaimCreatorFees(
  pool: string,
  creator: string,
): Promise<{ transaction: string }> {
  const { c, state } = await loadPool(pool);
  if (state.creator.toBase58() !== creator)
    throw new Error("only the creator of this curve can claim its fees");
  const key = new PublicKey(creator);
  const max = new BN("18446744073709551615");
  const tx = await c.creator.claimCreatorTradingFee({
    creator: key,
    payer: key,
    pool: new PublicKey(pool),
    maxBaseAmount: max,
    maxQuoteAmount: max,
  });
  const { blockhash } = await c.connection.getLatestBlockhash("confirmed");
  tx.feePayer = key;
  tx.recentBlockhash = blockhash;
  const wire = tx.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });
  return { transaction: Buffer.from(wire).toString("base64") };
}
