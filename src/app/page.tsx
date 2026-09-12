import Link from "next/link";
import { GlobeHero } from "@/components/globe-hero";
import { getRadar } from "@/lib/radar";
import { formatPct, formatUsd } from "@/lib/format";
import { TRADABILITY_LABEL } from "@/lib/radar-types";

export const dynamic = "force-dynamic";

export default function LandingPage() {
  const data = getRadar();
  const rows = data.rows.slice(0, 8);
  const movers = [...data.rows]
    .filter((r) => r.gapPct != null)
    .sort((a, b) => Math.abs(b.gapPct ?? 0) - Math.abs(a.gapPct ?? 0))
    .slice(0, 3);

  return (
    <>
      {/* Hero: text left, the globe right, nothing centered. */}
      <section className="grid items-center gap-10 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <h1 className="font-display text-[2.6rem] leading-[1.05] font-medium tracking-tight sm:text-6xl">
            Trade stocks when Wall Street sleeps.
          </h1>
          <p className="mt-6 max-w-xl text-[1.05rem] leading-relaxed">
            Real stocks, tokenized on Solana, keep trading after the closing bell and all weekend. After
            Hours tells you which ones are trading right now, whether the price you see is fresh, how far it
            has drifted from the last real print, and what a buy would actually cost. Then you buy from your
            own wallet.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <Link href="/stocks" className="btn">
              See what is trading now
            </Link>
            <Link href="#how" className="link text-sm">
              How it works
            </Link>
          </div>
        </div>
        <div className="lg:col-span-5">
          <GlobeHero phase={data.phase} stockCount={data.rows.length} generatedAt={data.generatedAt} />
        </div>
      </section>

      {/* Trading now: a typographic list, not a card grid. */}
      <section className="mt-20">
        <div className="flex items-baseline justify-between">
          <h2 className="kicker flex-1">Trading now</h2>
          <Link href="/stocks" className="link ml-6 text-sm">
            All {data.rows.length} stocks
          </Link>
        </div>
        <ul>
          {rows.map((r) => (
            <li key={r.underlying} className="border-b border-line">
              <Link
                href={`/stock/${r.underlying}`}
                className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-6 py-3 sm:grid-cols-[1fr_8rem_6rem_11rem]"
              >
                <span>
                  <span className="font-medium">{r.name}</span>
                  <span className="text-muted ml-2 text-xs">{r.symbol}</span>
                </span>
                <span className="num text-right">{formatUsd(r.price)}</span>
                <span className={`num text-right ${tone(r.gapPct)}`}>{formatPct(r.gapPct)}</span>
                <span className="text-muted hidden text-right text-sm sm:inline">
                  {TRADABILITY_LABEL[r.tradability]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-muted mt-3 text-sm">
          Difference is the onchain price against {data.reference.phrase}.
          {movers.length > 0 && (
            <>
              {" "}
              Moved most:{" "}
              {movers.map((m, i) => (
                <span key={m.underlying}>
                  {i > 0 ? ", " : ""}
                  <Link href={`/stock/${m.underlying}`} className="link text-ink">
                    {m.name}
                  </Link>{" "}
                  <span className={`num ${tone(m.gapPct)}`}>{formatPct(m.gapPct)}</span>
                </span>
              ))}
              .
            </>
          )}
        </p>
      </section>

      {/* How it works: a definition list, uneven on purpose. */}
      <section id="how" className="mt-20">
        <h2 className="kicker">How it works</h2>
        <dl className="mt-2 divide-y divide-line">
          <Row term="Pick a stock">
            Tesla, Nvidia, the S&amp;P 500 and {Math.max(0, data.rows.length - 3)} more. Each token is issued
            by a regulated company and backed one to one by a real share held with a custodian. Different
            issuers wrap the same stock differently, and we say which is which.
          </Row>
          <Row term="Check the price is real">
            Every price carries the time of its last trade, the depth of the pool behind it, and its distance
            from the last Wall Street print. A stale price is labeled stale. A thin market is labeled thin.
            Nothing is hidden behind a green button.
          </Row>
          <Row term="Buy from your own wallet">
            Enter an amount. We fetch a real quote, including how much your order would move the pool, and say
            in plain words whether now is a fair moment. If it is, you sign in Phantom, Backpack or Solflare
            and the swap runs through Jupiter. We never touch your money.
          </Row>
        </dl>
      </section>

      {/* Why: prose, with the one number that matters. */}
      <section className="mt-20 grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <h2 className="kicker">Why this exists</h2>
          <p className="mt-4 leading-relaxed">
            Brokerage apps close at four and stay shut all weekend. News does not. More than half of all
            tokenized-stock trading already happens outside US market hours, almost all of it on Solana. The
            catch: while Wall Street is closed, the onchain price floats on thin pools and can drift a few
            percent on a headline. Other apps show you a number and a buy button. We show you whether the
            number is real.
          </p>
        </div>
        <div className="lg:col-span-5">
          <h2 className="kicker">What we will not do</h2>
          <ul className="mt-4 space-y-2 leading-relaxed">
            <li>Hold your money. Every trade is signed in your wallet.</li>
            <li>List a token with less than 50k USD of real liquidity.</li>
            <li>Call a price fresh when it last traded an hour ago.</li>
            <li>Call a weekend drift an opportunity. It is a drift.</li>
            <li>Pretend a pre-IPO token is a share. Those are not listed.</li>
          </ul>
        </div>
      </section>
    </>
  );
}

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 py-5 sm:grid-cols-12 sm:gap-8">
      <dt className="font-display text-xl sm:col-span-4">{term}</dt>
      <dd className="text-muted leading-relaxed sm:col-span-8">{children}</dd>
    </div>
  );
}

function tone(gap: number | null): string {
  if (gap == null || Math.abs(gap) < 0.25) return "text-muted";
  return gap > 0 ? "text-up" : "text-down";
}
