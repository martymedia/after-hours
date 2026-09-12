// Builds the list of stock tokens we track: every issuer's tokens grouped by
// the real-world stock they represent. Sources: the xStocks public API (full
// list with Solana mints) and Jupiter token search (other issuers, tagged).

import { ISSUERS, ISSUER_ORDER, issuerFromTags, type IssuerId } from "./issuers.ts";
import { getPrices, searchTokens, type JupiterSearchToken } from "./jupiter.ts";

const XSTOCKS_API = "https://api.backed.fi/api/v2/public";

/** Below this we do not list a token at all; the price would be noise. */
export const MIN_LIQUIDITY_USD = 50_000;
/** Listing floor. Same bar today; kept separate so the radar can mark a token
 *  thin if its pool shrinks between two universe rebuilds. */
export const MIN_LIST_LIQUIDITY_USD = MIN_LIQUIDITY_USD;

export type UniverseToken = {
  mint: string;
  symbol: string;
  name: string;
  /** Ticker of the real-world stock, shared across issuers (e.g. TSLA). */
  underlying: string;
  issuer: IssuerId;
  decimals: number;
  logo: string | null;
  liquidity: number;
};

type XStocksAsset = {
  symbol: string;
  name: string;
  underlyingSymbol: string;
  logo?: string;
  isTradingHalted: boolean;
  deployments: { address: string; network: string }[];
};

async function fetchXStocksAssets(): Promise<XStocksAsset[]> {
  const out: XStocksAsset[] = [];
  for (let page = 1; page < 20; page++) {
    const res = await fetch(`${XSTOCKS_API}/assets?limit=100&page=${page}`, {
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`xStocks assets ${res.status}`);
    const body = (await res.json()) as { nodes: XStocksAsset[]; page: { hasNextPage: boolean } };
    out.push(...body.nodes);
    if (!body.page.hasNextPage) break;
  }
  return out;
}

// Symbol clean-up for issuers whose tickers are not the plain stock ticker.
const UNDERLYING_ALIASES: Record<string, string> = {
  SPACEX: "SPCX",
  TSPACEX: "SPCX",
  TOPENAI: "OPENAI",
  TKALSHI: "KALSHI",
  TANTHROPIC: "ANTHROPIC",
};

function underlyingFor(token: JupiterSearchToken, issuer: IssuerId): string {
  let sym = token.symbol.toUpperCase();
  if (issuer === "ondo" && sym.endsWith("ON")) sym = sym.slice(0, -2);
  if (issuer === "tessera" && sym.startsWith("T") && token.symbol[0] === "t") sym = sym.slice(1);
  return UNDERLYING_ALIASES[sym] ?? UNDERLYING_ALIASES[token.symbol.toUpperCase()] ?? sym;
}

const NAME_OVERRIDES: Record<string, string> = {
  SPY: "S&P 500 ETF",
  QQQ: "Nasdaq 100 ETF",
  GLD: "Gold ETF",
  STRC: "Strategy Preferred",
  "BRK.B": "Berkshire Hathaway",
};

function cleanName(name: string): string {
  return name
    .replace(/\s*\((Ondo Tokenized|Backpack Securities)\)\s*/i, "")
    .replace(/\s*-\s*Backpack Securities\s*$/i, "")
    .replace(/\s+xStock$/i, "")
    .replace(/\s+PreStocks$/i, "")
    .replace(/^T-/, "")
    .replace(/\s+Common Stock$/i, "")
    .replace(/,?\s+Inc\.?$/i, "")
    .replace(/\s+Corp\.?$/i, "")
    .trim();
}

export async function buildUniverse(): Promise<UniverseToken[]> {
  const byMint = new Map<string, UniverseToken>();

  // 1. xStocks: authoritative list with underlying tickers.
  const assets = await fetchXStocksAssets();
  const xMints: { mint: string; asset: XStocksAsset }[] = [];
  for (const a of assets) {
    const dep = a.deployments.find((d) => d.network === "Solana");
    if (!dep || a.isTradingHalted) continue;
    xMints.push({ mint: dep.address, asset: a });
  }
  const xPrices = await getPrices(xMints.map((x) => x.mint));
  for (const { mint, asset } of xMints) {
    const p = xPrices[mint];
    if (!p?.usdPrice) continue;
    byMint.set(mint, {
      mint,
      symbol: asset.symbol,
      name: NAME_OVERRIDES[asset.underlyingSymbol.toUpperCase()] ?? cleanName(asset.name),
      underlying: asset.underlyingSymbol.toUpperCase(),
      issuer: "xstocks",
      decimals: p.decimals ?? 8,
      logo: asset.logo ?? null,
      liquidity: p.liquidity ?? 0,
    });
  }

  // 2. Other issuers via Jupiter search, identified by tag.
  for (const issuerId of ISSUER_ORDER) {
    const issuer = ISSUERS[issuerId];
    if (!issuer.enabled) continue;
    for (const q of issuer.searchQueries) {
      let results: JupiterSearchToken[] = [];
      try {
        results = await searchTokens(q);
      } catch {
        continue;
      }
      for (const t of results) {
        const tagged = issuerFromTags(t.tags);
        if (tagged !== issuerId || !t.tags?.includes("stocks")) continue;
        if (byMint.has(t.id)) continue;
        byMint.set(t.id, {
          mint: t.id,
          symbol: t.symbol,
          name: NAME_OVERRIDES[underlyingFor(t, issuerId)] ?? cleanName(t.name),
          underlying: underlyingFor(t, issuerId),
          issuer: issuerId,
          decimals: t.decimals,
          logo: t.icon ?? null,
          liquidity: t.liquidity ?? 0,
        });
      }
    }
  }

  // 3. Keep every stock that has at least one token with a real pool, and
  //    all issuers of it (so the comparison view can say "no liquidity").
  const listedUnderlyings = new Set(
    [...byMint.values()].filter((t) => t.liquidity >= MIN_LIST_LIQUIDITY_USD).map((t) => t.underlying),
  );
  return [...byMint.values()]
    .filter((t) => listedUnderlyings.has(t.underlying))
    .sort((a, b) => b.liquidity - a.liquidity);
}
