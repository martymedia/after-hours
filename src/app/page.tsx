import Link from "next/link";
import { GlobeHero } from "@/components/globe-hero";
import { getRadar } from "@/lib/radar";
import { formatPct, formatUsd } from "@/lib/format";
import { TRADABILITY_LABEL, type Tradability } from "@/lib/radar-types";

export const dynamic = "force-dynamic";

const PILL: Record<Tradability, string> = {
  easy: "bg-soft-up text-up",
  ok: "bg-soft text-ink",
  thin: "bg-soft-warn text-warn",
  stale: "bg-soft-warn text-warn",
  none: "bg-soft text-muted",
};

export default function LandingPage() {
  const data = getRadar();
  const rows = data.rows.slice(0, 8);
  const movers = [...data.rows]
    .filter((r) => r.gapPct != null)
    .sort((a, b) => Math.abs(b.gapPct ?? 0) - Math.abs(a.gapPct ?? 0))
    .slice(0, 3);

  return (
    <>
      {/* The night: a dark panel, text left, the lit globe bleeding off the right. */}
      <section className="relative overflow-hidden rounded-xl bg-night text-white">
        <div className="grid items-center gap-8 px-6 py-10 sm:px-10 sm:py-14 lg:grid-cols-12 lg:gap-4">
          <div className="lg:col-span-6">
            <h1 className="text-[2.5rem] leading-[1.02] font-semibold tracking-tight sm:text-6xl">
              Trade stocks when Wall Street sleeps.
            </h1>
            <p className="mt-6 max-w-lg text-[1.05rem] leading-relaxed text-white/70">
              Real stocks, tokenized on Solana, keep trading after the closing bell and all weekend. See which
              ones are moving right now, whether the price is fresh, and what a buy really costs. Then buy from
              your own wallet.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <Link href="/stocks" className="btn btn-light">
                See what is trading now
              </Link>
              <Link href="#how" className="text-sm text-white/70 hover:text-white">
                How it works
              </Link>
            </div>
          </div>
          <div className="lg:col-span-6">
            <GlobeHero phase={data.phase} stockCount={data.rows.length} generatedAt={data.generatedAt} />
          </div>
        </div>
      </section>

      {/* Trading now: the table people liked, kept clean. */}
      <section className="mt-14">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Trading now</h2>
          <Link href="/stocks" className="text-sm font-medium hover:underline">
            All {data.rows.length} stocks →
          </Link>
        </div>
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.underlying}>
                <Link
                  href={`/stock/${r.underlying}`}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-x-5 px-4 py-3 transition hover:bg-paper sm:grid-cols-[1fr_8rem_6rem_12rem]"
                >
                  <span className="flex flex-col">
                    <span className="font-medium">{r.name}</span>
                    <span className="text-muted text-xs">
                      {r.symbol} · {r.issuerName}
                    </span>
                  </span>
                  <span className="num text-right">{formatUsd(r.price)}</span>
                  <span className={`num text-right font-medium ${tone(r.gapPct)}`}>{formatPct(r.gapPct)}</span>
                  <span className="hidden text-right sm:block">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${PILL[r.tradability]}`}>
                      {TRADABILITY_LABEL[r.tradability]}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-muted mt-3 text-sm">
          Difference is the onchain price against {data.reference.phrase}.
          {movers.length > 0 && (
            <>
              {" "}
              Moved most:{" "}
              {movers.map((m, i) => (
                <span key={m.underlying}>
                  {i > 0 ? ", " : ""}
                  <Link href={`/stock/${m.underlying}`} className="text-ink hover:underline">
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

      {/* How it works: three columns, no cards, no numbers. */}
      <section id="how" className="mt-16">
        <h2 className="text-xl font-semibold tracking-tight">How it works</h2>
        <div className="mt-5 grid gap-8 sm:grid-cols-3">
          <Col title="Pick a stock">
            Tesla, Nvidia, the S&amp;P 500 and {Math.max(0, data.rows.length - 3)} more. Each token is issued
            by a regulated company and backed one to one by a real share. Different issuers wrap the same
            stock differently, and we say which is which.
          </Col>
          <Col title="Check the price is real">
            Every price carries the time of its last trade, the depth of the pool behind it, and its distance
            from the last Wall Street print. Stale is labeled stale. Thin is labeled thin.
          </Col>
          <Col title="Buy from your own wallet">
            Enter an amount, get a real quote including how much your order moves the pool, and a plain verdict
            on whether now is a fair moment. Sign in Phantom, Backpack or Solflare. The swap runs through
            Jupiter. We never touch your money.
          </Col>
        </div>
      </section>

      {/* Why, and the rules. */}
      <section className="mt-16 grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Why this exists</h2>
          <p className="text-muted mt-3 leading-relaxed">
            Brokerage apps close at four and stay shut all weekend. News does not. More than half of all
            tokenized-stock trading already happens outside US market hours, almost all of it on Solana. The
            catch: while Wall Street is closed, the onchain price floats on thin pools and can drift a few
            percent on a headline. Other apps show you a number and a buy button. We show you whether the
            number is real.
          </p>
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">What we will not do</h2>
          <ul className="text-muted mt-3 space-y-2 leading-relaxed">
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

function Col({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-muted mt-2 text-sm leading-relaxed">{children}</p>
    </div>
  );
}

function tone(gap: number | null): string {
  if (gap == null || Math.abs(gap) < 0.25) return "text-muted";
  return gap > 0 ? "text-up" : "text-down";
}
