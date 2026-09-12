# After Hours

Trade stocks when Wall Street sleeps. A clean, minimal web app that shows
which tokenized stocks on Solana are trading right now while Nasdaq is closed,
how far the onchain price has drifted from the last real print, whether that
price is fresh, and what a trade would actually cost after slippage and fees.
One click builds the Jupiter swap, the user signs in their own wallet. We
never hold funds. Screener plus convenience, not a venue.

Hackathon: Stocklana (Solana Foundation), submissions close
Fri 2026-09-18 16:00 ET (22:00 CEST). Wedge: Consumer trading, with the
analytics engine (net edge, cross-issuer, drift) as the differentiator.

## 1. User and problem

User: crypto-native retail outside the US who holds or wants stock exposure
and reacts to news on evenings, weekends and holidays.

Problem: brokerages are closed (Robinhood 24/5 at best, Nasdaq 23/5 from
Dec 2026, both dead on weekends). Onchain the stocks trade, and 55 percent of
tokenized-equity volume already happens outside US hours (Blockworks and
RWA.xyz via Crypto Briefing, 2026-08-19); Labor Day weekend alone did 1.01
billion USD on Saturday and Sunday. But the onchain price is unreliable in
exactly those hours: it floats on thin pools, drifts 3 to 5 percent on news,
and for illiquid names the "price" is a days-old trade. Existing UIs (Jupiter,
Phantom, Exodus Markets, Backpack) show a price and a buy button, nothing
about freshness, drift, or real cost at size.

Why Solana: this is the only place these tokens trade with real liquidity
(95 percent share), sub-second settlement, cents in fees, self custody.

## 2. Verified data sources (probed 2026-09-12, a Saturday)

| Need | Source | Notes |
|---|---|---|
| Universe + issuer tags | Jupiter Tokens v2 search `lite-api.jup.ag/tokens/v2/search?query=` | Tags: `stocks`, `xstocks`, `ondo`, `backpack`, `prestocks`, `tessera`, `shift`. No key. Returns `stats24h`, `holderCount`, `liquidity`, `scaledUiConfig`. |
| xStocks list + Solana mints | `api.backed.fi/api/v2/public/assets?limit=100&page=N` | 732 Solana mints, only ~130 priced, 17 with >200k liquidity. No key. |
| Onchain price + reference | Jupiter Price v3 `lite-api.jup.ag/price/v3?ids=` | Max 50 ids per call. `usdPrice` = last swap. `stockData.price` = reference (likely Pyth, Blue Ocean overnight), `stockData.updatedAt`, `blockId` for staleness. Updates on weekends (value = last close). |
| Executable price for size | Jupiter Quote `lite-api.jup.ag/swap/v1/quote` | `maxAccounts=33`, `slippageBps`. `outAmount`, `priceImpactPct`, `routePlan`. |
| Swap tx | `POST lite-api.jup.ag/swap/v1/swap` | Unsigned tx, user signs. `platformFeeBps` on quote + `feeAccount` on swap. |
| Market phase | xStocks `assets/{sym}.trading.currentPeriod` + `nextChangeAt` | `market`, `extended`, `overnight`, `closed`. Blue Ocean overnight is Sun to Thu 20:00 to 04:00 ET, no Friday night session. |
| Price history (demo-ready, no collector needed) | GeckoTerminal `api.geckoterminal.com/api/v2/networks/solana/pools/{pool}/ohlcv/hour?limit=168` | Free, no key, 168 hourly candles per pool, 30 req/min. Pools per token via `/networks/solana/tokens/{mint}/pools`. |
| Pair stats | DexScreener `api.dexscreener.com/latest/dex/tokens/{mint}` | Free, `priceChange.h1/h24`, per-pool liquidity, 30 pairs for TSLAx. |
| Earnings calendar | Nasdaq `api.nasdaq.com/api/calendar/earnings?date=YYYY-MM-DD` | Works with a browser User-Agent header, no key. Finnhub needs a key. |
| Multipliers (splits) | xStocks `assets/{sym}/multiplier?network=Solana` | Jupiter also returns `scaledUiConfig.multiplier`. |
| Proof of reserves | `api.backed.fi/api/v2/public/proof-of-reserves` | Trust badge on detail page. |
| 24/7 oracle (optional) | Pyth `Equity.Index.<TICKER>/USD` (28 feeds) | Hermes needs an API key since 2026-08-26. Skip unless quick. |

Live sample (Saturday 10:50 UTC):

| Token | Onchain | Ref | Gap | Liquidity |
|---|---|---|---|---|
| TSLAx | 364.68 | 365.25 | -0.16% | 1.27M |
| NVDAx | 219.25 | 218.26 | +0.45% | 1.90M |
| SPYx | 765.82 | 764.29 | +0.20% | 4.89M |
| SPCX (Backpack) | 149.95 | 150.28 | -0.22% | 654k |
| SPCXx | 149.99 | 150.28 | -0.19% | 1.01M |
| NVDAon (Ondo) | 226.95 | 218.26 | +3.98% | 482 USD, no route |

## 3. Deep-analysis findings

Competition:
- Jupiter `jup.ag/spot/stocks` has a "Discount / Mark" column and issuer
  filter. Phantom sells xStocks in-wallet, Exodus Markets sells Ondo, Backpack
  app sells its own. All are price plus buy button. None show freshness,
  drift vs last close, net cost at size, cross-issuer comparison, or an
  earnings-aware view. That is the whole product.
- Broker side: Robinhood 24/5, Nasdaq 23/5 from 2026-12-06, NYSE 22h. All
  closed on weekends and holidays. The weekend and holiday moat stays; the
  overnight moat shrinks in December, so the pitch leads with weekends,
  holidays, self custody and "no broker account".

Universe (measured): realistic radar is 40 to 60 rows. xStocks 17 liquid,
Backpack ~16, PreStocks 8, Tessera 3. Ondo has zero AMM liquidity and
NO_ROUTES_FOUND on Jupiter: shown as "no onchain liquidity", never executable.

Gap reality: liquid xStocks median absolute gap 0.19 percent on a Saturday,
max 0.80 percent. Illiquid tokens show gaps of hundreds of percent from
days-old trades. Pre-IPO cross-issuer spreads are big (PreStocks OPENAI 1198
vs Tessera tOpenAI 961 vs mark 999) but different legal structures.

Earnings during hackathon week: none in our universe. Next are MU
2026-09-30 after hours and NKE 2026-10-01. The calendar is a feature, not the
demo. The demo leans on weekend drift, freshness, and net cost.

Hard rules:
1. Universe filter: liquidity >= 50k USD or last trade younger than 24h.
2. Every row carries last-trade age; older than 1h is "stale", never green.
3. Cross-issuer rows carry a structure label (tracker cert, redeemable share,
   SPV, note); only same-structure pairs count as arb.
4. Closed period: reference labeled "last close", shown as drift, never as
   arb. Green execute state only exists while a live reference exists.
5. No custody, no pooled funds, no Ondo mint or redeem, no primary-market
   redemption, no leveraged Shift tokens in v1.

Open check: does Jupiter `stockData` move during the Blue Ocean overnight
session? Verify Sunday 20:00 ET (Monday 02:00 CEST). If not, add Pyth or the
xStocks price-data endpoint as the overnight reference.

Wallet stack: `@solana/kit` 7+, `@solana/react`, `kit-plugin-wallet`
(Wallet Standard discovery), per the solana.com Next.js App Router guide.
Not the year-old wallet-adapter.

Legal: xStocks carry an EU base prospectus (Liechtenstein FMA), fine for a
German builder and EU users. Not for US persons. Disclaimer on every
execute, no advice language, simple US geo block on the frontend.

## 4. Gap types (labeled in the UI)

1. Onchain vs reference: real mispricing during market hours; "drift vs
   last close" while closed.
2. Issuer vs issuer: same underlying, different issuer. Closable onchain
   with one direct route or two swaps.
3. Onchain vs primary market: discount to NAV only an onboarded issuer
   client can close. Badge only.

## 5. Net edge

```
gross_gap  = usdPrice / reference - 1
exec_price = S / outAmount            (decimals and multiplier applied)
net_edge   = reference / exec_price - 1 - platform_fee_bps / 1e4 - est_tx_fee / S
```

Button: green if net_edge > 0.30 percent and reference is live; amber if
0 < net_edge <= 0.30 percent; grey otherwise with the reason in a tooltip.
While closed the button is "Buy anyway" in neutral style with the drift
warning, never green.

## 6. Screens (brand guide: Outfit, blue, black, white)

Brand (from Maik's reference dashboard, 2026-09-12): Outfit for everything,
blue #5B91FF as the one accent, black #121214 for buttons and dark panels,
white cards with 20px radius on a light grey ground (#F4F4F6), pill buttons
and pill badges, a dark chart panel with a white line. Green and red only
for up and down. No gradients. Logo: the open clock face with a price line
running past its edge, white on a blue disc. Tagline "Trade stocks when
Wall Street sleeps."

Shell: icon rail on the left (desktop), top bar with page title and stock
search, bottom tab bar on phones. Every jargon term has a hover tooltip.

0. **Overview (/).** Four KPI cards (Wall Street status with countdown,
   stocks trading onchain, biggest move, next earnings). Dark panel with the
   headline, CTA, New York clock and the three.js globe: land as dots, the
   real night side lit in blue, New York marked. Below: "Moved most" as
   three dark tiles with sparklines, "Trading now" list with ticker badges,
   "How it works" card, "What we will not do" dark card.

1. **Stocks (/stocks).** Status card with the phase line, earnings ahead and
   an issuer filter (All, xStocks, Backpack). Under it the table in a card:
   ticker + issuer pill, onchain price, last close or live reference, drift
   in percent (color), freshness (e.g. "2m ago" or "stale 6h"), liquidity,
   net cost at 1k (percent), 7-day sparkline from GeckoTerminal. Filters:
   issuer, liquid only, movers. Auto-refresh 15 s. A small "Next earnings"
   strip: MU Sep 30 AMC, NKE Oct 1.
2. **Stock (/stock/TSLA).** Ticker badge and name, four KPI cards (onchain
   price with change pill, reference, updated with tradability pill, next
   earnings). Dark chart panel: white line with soft area, closed hours
   shaded, dashed blue reference line, 24h/7d segmented control, hover
   readout with date, time (ET) and price. "Where it trades" card with one
   tile per issuer (structure label with tooltip). Sticky buy card: amount
   field with preset pills, real Jupiter quote (you get, per share, price
   impact), one verdict line (fair moment / reasonable with a caveat /
   better wait) and four checks: Price, Freshness, Size, Market.
3. **Buy.** Inside the buy card: connect a Wallet Standard wallet, the
   server builds the Jupiter swap, the browser signs and sends, Solscan
   link. No wallet installed: plain Jupiter link.

Add-ons only after the three screens are solid: Telegram alerts ("ping me
if TSLAx drifts more than 2 percent this weekend"), positions.

## 7. Architecture

- Next.js 16 App Router, TypeScript, Tailwind, recharts. Read
  `node_modules/next/dist/docs/` before framework code.
- Collector (`scripts/collector.ts`): every 30 s price v3 in chunks of 50,
  every 5 min xStocks period + DexScreener stats, daily Nasdaq calendar and
  GeckoTerminal backfill. SQLite via Prisma.
- Wallet and swap: `@solana/kit`, Jupiter lite-api, tx signed client side,
  sent via Helius free tier.
- Deploy: Hetzner VPS behind the shared Caddy (never touch the shared
  conf.d import).

## 8. Revenue (one line)

Jupiter `platformFeeBps` (10 to 20 bps) on executed swaps, later paid
alerts. Free radar forever.

## 9. Demo script (2 to 3 min, record Sunday evening or Monday)

1. Sunday 20:00 CEST: home shows "Nasdaq closed, opens in 20h", 47 stocks
   trading, drift column alive. Say the 55 percent number.
2. Click TSLA: chart with the shaded weekend, price wandering around Friday
   close, three issuer cards.
3. Click NVDA: Ondo card says "no onchain liquidity", xStocks card fresh.
   Show net cost at 1k vs 10k.
4. Execute a 20 USD TSLAx buy live, drawer shows real cost and the
   disclaimer, sign, tx link.
5. Close: "Every other app shows you a price. We show you whether it is
   real, and what it costs. No broker, no custody."
