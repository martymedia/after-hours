# After Hours

Trade stocks when Wall Street sleeps. Tokenized versions of real stocks keep
trading on Solana around the clock. After Hours shows which ones are trading
right now, how far the onchain price has drifted from the last real print,
whether that price is fresh, and what a trade would actually cost after
slippage and fees. It builds the swap through Jupiter; you sign it in your own
wallet. Nothing is held for you.

Built in one week for the Solana Foundation's Stocklana hackathon.
Live at https://after-hour.net. MIT licensed.

## Run it

Requires Node 24 (uses the built-in SQLite driver and runs TypeScript directly).

```bash
npm install
cp .env.example .env
npm run collector   # keeps running: prices every minute, candles hourly
npm run dev         # web app on http://localhost:3000
```

The collector fills `data/after-hours.db`. The web app only reads it.

## Data sources

| What                                      | Source                                                        |
| ----------------------------------------- | ------------------------------------------------------------- |
| Stock tokens and issuers                  | Jupiter token search (tags) and the xStocks public asset list |
| Onchain price, liquidity, reference price | Jupiter Price API v3                                          |
| Executable price and swap transaction     | Jupiter Quote and Swap API                                    |
| Hourly price history                      | GeckoTerminal public API                                      |
| Earnings dates                            | Nasdaq public calendar                                        |

## Wallet

Once a wallet is connected, a "Your wallet" group appears in the menu and a
short address chip in the top bar. The page reads the wallet live (server-side
RPC, cached 45 s): stocks value, gain since purchase from an average-cost
basis over the last 50 transactions, 24-hour change, realized gains, the
After Hours edge (what you paid per share versus the reference price at that
moment, summed over your buys), allocation, best position, next earnings in
your holdings, per-position sparkline and cost, and every buy or sell with a
Solscan link. Nothing is stored; disconnecting removes the entry.

## Sell, limit orders, share cards, heatmap

- Sell from the Wallet page: a real quote for the size against the reference,
  then the same signing flow as buying (quote and swap routes take `side=sell`).
- Limit orders ("Set a price and sleep") on every stock page: a Jupiter
  Trigger V1 order owned by the user's wallet, non-custodial, fills if the
  onchain price reaches the target, cancel from the Wallet page. No API key.
  The order form needs a connected wallet; on the sell side it reads the
  holding from chain (`/api/holding`) and offers 10 / 25 / 50 % / All presets.
- `/wallet/[address]` is a read-only view of any wallet; `/trade/[signature]`
  is a shareable page for one swap with its own Open Graph card.
- The overview has a treemap of tradable stocks: area by liquidity, colour by
  gap to the reference.

## Curves (Meteora DBC monitor)

`/curves` watches Meteora Dynamic Bonding Curve launches that use one of our
tokenized stocks as the quote token. The collector finds them without walking
the whole program: a pool config stores its quote mint at byte offset 8 and a
pool stores its config at offset 72, so two filtered `getProgramAccounts`
calls per stock and config cover everything (`src/lib/dbc.ts`, tables in
`src/lib/dbc-db.ts`). Full scan every 30 minutes, live pools refreshed every
two minutes from `getMultipleAccounts`, token names from the RPC's DAS
`getAsset`. The page shows progress to graduation, quote raised and fees,
priced in USD through the stock's own onchain price, with the stock's
freshness pill so a stale quote cannot pass as a real valuation.

`/curves/build` is the other half: a curve builder for issuers. Pick a stock,
set the starting and graduation market caps in dollars, choose a fee path;
the server converts through the stock's onchain price, builds the config with
the SDK's `buildCurveWithMarketCap`, runs `validateConfigParameters`, and
shows what the curve does (start price, graduation price, quote to raise,
fee schedule) plus the raw parameters. "Create on mainnet" builds one
`createConfigAndPool` transaction with the stock's token badge; the config and
launch-mint keypairs are generated server-side and co-sign, the user's wallet
pays and signs. Liquidity on graduation is permanently locked. Every curve
built here names our revenue wallet as the partner fee claimer with a fixed
90/10 split of trading fees (creator/After Hours), mirrored in the locked
liquidity after graduation. The mint points its metadata URI at
`/api/curves/token/<mint>`, which we serve from what the builder stored, so
a creator only pastes a link to an icon.

Every live curve on a stock page has a Trade button: buy the launch token
with the stock token or sell it back to the curve, quoted with the SDK's
`swapQuote` and sent as one `pool.swap` transaction the wallet signs
(`src/lib/curve-trade.ts`). A creator who connects the wallet that made a
curve sees the trading fees it has earned and can claim them. Pools whose
name or symbol carries slurs or crude words are hidden (`src/lib/profanity.ts`).

## Pre-IPO (PreStocks)

 lists the private companies PreStocks tokenizes: OpenAI, SpaceX,
Anthropic, Neuralink and four more. They have no exchange price, so the
reference is the mark their issuer carries the SPV at, which Jupiter returns
as  alongside the onchain price; the collector already stores it
as the reference, so these tokens flow through the same snapshots, sparklines
and alerts as the stocks. What we add is the distance to that mark, its
history from our own snapshots, and the real cost of a small buy: pool size
flatters these markets, and a 25 USD buy can cost three percent in price
impact on a token showing 280k in pools, so we quote it per company.

They stay off the stock pages on purpose ( versus
): the copy there is about Wall Street, and none of it is
true here. Every page says what the token is, in the issuer's own terms: SPV
exposure, no ownership, no voting, no dividend, no guaranteed buyer.

## Honesty rules

- A token with less than 50k USD of onchain liquidity is not listed.
- A price older than one hour is marked stale and never gets a green button.
- While Wall Street is closed the reference is the last close, shown as
  drift, never as an opportunity.
- Tokens from different issuers are labelled by legal structure. They are not
  interchangeable.
- Pre-IPO tokens are not listed in v1: there is no real market price to
  compare against.

Nothing here is investment advice. Not available to US persons.
