# After Hours

Trade stocks when Wall Street sleeps. Tokenized versions of real stocks keep
trading on Solana around the clock. After Hours shows which ones are trading
right now, how far the onchain price has drifted from the last real print,
whether that price is fresh, and what a trade would actually cost after
slippage and fees. It builds the swap through Jupiter; you sign it in your own
wallet. Nothing is held for you.

Built in one week for the Solana Foundation's Stocklana hackathon.

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

| What | Source |
|---|---|
| Stock tokens and issuers | Jupiter token search (tags) and the xStocks public asset list |
| Onchain price, liquidity, reference price | Jupiter Price API v3 |
| Executable price and swap transaction | Jupiter Quote and Swap API |
| Hourly price history | GeckoTerminal public API |
| Earnings dates | Nasdaq public calendar |

## Wallet

Once a wallet is connected, a "Your wallet" group appears in the menu and a
short address chip in the top bar. The page reads the wallet live (server-side
RPC, cached 45 s): stocks value, gain since purchase from an average-cost
basis over the last 50 transactions, 24-hour change, realized gains, the
After Hours edge (what you paid per share versus the reference price at that
moment, summed over your buys), allocation, best position, next earnings in
your holdings, per-position sparkline and cost, and every buy or sell with a
Solscan link. Nothing is stored; disconnecting removes the entry.

## Honesty rules

- A token with less than 50k USD of onchain liquidity is not listed.
- A price older than one hour is marked stale and never gets a green button.
- While Wall Street is closed the reference is the last close, shown as
  drift, never as an opportunity.
- Tokens from different issuers are labeled by legal structure. They are not
  interchangeable.
- Pre-IPO tokens are not listed in v1: there is no real market price to
  compare against.

Nothing here is investment advice. Not available to US persons.
