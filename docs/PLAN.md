# After Hours: one-week plan

Sat 2026-09-12 to Fri 2026-09-18. Deadline 16:00 ET = 22:00 CEST.
Rule: the collector runs from day 1; GeckoTerminal backfill covers the demo
history in case the collector has gaps.

## Sat 09-12 (today)

- [x] Research, data sources probed, spec written
- [ ] Register on hackathons.solana.com
- [ ] Scaffold Next.js 16 app, Prisma + SQLite, lint and typecheck scripts
- [ ] Universe builder: xStocks assets (paginated) plus Jupiter search for
      backpack, prestocks, tessera mints, grouped by underlying symbol,
      liquidity filter, structure label per issuer
- [ ] Collector: price v3 every 30 s (chunks of 50), xStocks period every
      5 min, GeckoTerminal hourly backfill once
- [ ] Deploy collector to Hetzner tonight

## Sun 09-13

- [ ] Home: status line (phase, countdown from nextChangeAt), table with
      drift, freshness, liquidity, net cost at 1k, sparkline
- [ ] Net cost via Jupiter quote (server route, cached 15 s)
- [ ] 02:00 CEST check: does stockData move during Blue Ocean overnight?

## Mon 09-14

- [ ] Ticker page: issuer cards, 7-day chart with reference line and shaded
      closed periods, proof of reserves, multiplier, next earnings
- [ ] Execute drawer with @solana/kit wallet, quote, unsigned swap, sign,
      send; test with 5 to 20 USD on mainnet

## Tue 09-15

- [ ] Earnings strip from Nasdaq calendar (daily job)
- [ ] Polish: empty and error states, mobile, disclaimer, US geo block
- [ ] platformFeeBps and feeAccount wired
- [ ] Deploy web app to Hetzner behind Caddy

## Wed 09-16 (add-ons, only if core is solid)

- [ ] Telegram drift alerts (grammY)
- [ ] Positions with "drift closed" ping

## Thu 09-17

- [ ] README (problem, data sources, honesty rules, run instructions)
- [ ] Record demo video per SPEC section 9 (or Sunday evening if ready)
- [ ] Submit early (edits allowed until close)

## Fri 09-18

- [ ] Buffer, final submission edit, post video, tag @solana

## Risks

- No earnings in our universe this week: demo leans on weekend drift and
  freshness, calendar shows MU Sep 30
- Weekend reference is last close: label clearly, never green
- Jupiter stockData overnight behavior unknown until Sunday night
- GeckoTerminal 30 req/min: backfill slowly, cache aggressively
- Do not spend more than about 50 USD on mainnet tests
