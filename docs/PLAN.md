# After Hours: one-week plan

Sat 2026-09-12 to Fri 2026-09-18. Deadline 16:00 ET = 22:00 CEST.
Rule: the collector runs from day 1; GeckoTerminal backfill covers the demo
history in case the collector has gaps.

## Sat 09-12 (done)

- [x] Research, data sources probed, spec written
- [x] Scaffold Next.js 16 app, node:sqlite (no ORM), lint and typecheck scripts
- [x] Universe builder: xStocks assets plus Jupiter search for Backpack and
      Ondo, grouped by underlying, liquidity filter, structure label per
      issuer. Pre-IPO issuers excluded in v1.
- [x] Collector: price v3 every 60 s (chunks of 50), GeckoTerminal hourly
      candles (slow pacing, 429 backoff), Nasdaq earnings twice a day
- [x] Home: status line, table with drift, freshness, tradability, sparkline
- [x] Stock page: issuer cards, 7-day chart with closed shading, cost
      calculator with a real Jupiter quote
- [x] Wallet buy flow: Solana Kit wallet, server-built Jupiter swap, sign
      and send in the browser, Jupiter link fallback
- [x] Earnings strip on home and next-earnings on the stock page
- [x] platformFeeBps and feeAccount wired (env, off by default)
- [~] Deploy collector plus web to Hetzner (own compose project); domain
      still missing
- [ ] Register on hackathons.solana.com (Maik)

## Sun 09-13

- [ ] 02:00 CEST check: does stockData move during Blue Ocean overnight?
- [ ] Test a real 5 to 20 USD buy on mainnet with Maik's wallet
- [ ] Mobile layout pass, empty and error states
- [ ] Domain + Caddy block, public URL

## Mon 09-14

- [ ] Polish and copy pass with fresh eyes
- [ ] US geo block on the buy button
- [ ] Verify overnight and market-hours reference during the first weekday

## Tue 09-15

- [ ] Buffer for whatever the weekend data revealed
- [ ] Start README and demo script

## Wed 09-16 (add-ons, only if core is solid)

- [ ] Telegram drift alerts (grammY)
- [ ] Positions with "drift closed" ping

## Thu 09-17

- [ ] Record demo video per SPEC section 9 (or Sunday evening if ready)
- [ ] Submit early (edits allowed until close)

## Fri 09-18

- [ ] Buffer, final submission edit, post video, tag @solana

## Risks

- No earnings in our universe this week: demo leans on weekend drift and
  freshness, calendar shows MU Sep 30
- Weekend reference is the last close: label it clearly, never green
- Jupiter stockData overnight behavior unknown until Sunday night
- GeckoTerminal throttles hard (429 after ~5 quick calls): 6 s pacing, 65 s backoff
- Do not spend more than about 50 USD on mainnet tests
