import Link from "next/link";
import { LogoMark } from "@/components/logo";
import { getRadar } from "@/lib/radar";
import { formatDuration, formatPct, formatUsd } from "@/lib/format";
import { TRADABILITY_LABEL } from "@/lib/radar-types";

export const dynamic = "force-dynamic";

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "long",
  hour: "numeric",
  minute: "2-digit",
});

export default function LandingPage() {
  const data = getRadar();
  const now = Date.parse(data.generatedAt);
  const closed = data.phase.phase !== "open";
  const untilOpen = formatDuration(new Date(data.phase.nextOpen).getTime() - now);
  const opensAt = dayFormatter.format(new Date(data.phase.nextOpen));
  const preview = [...data.rows].slice(0, 6);
  const movers = [...data.rows]
    .filter((r) => r.gapPct != null)
    .sort((a, b) => Math.abs(b.gapPct ?? 0) - Math.abs(a.gapPct ?? 0))
    .slice(0, 3);

  return (
    <>
      {/* Hero */}
      <section className="py-6 sm:py-10">
        <div className="flex items-center gap-3">
          <LogoMark size={48} />
          <span className="text-muted text-sm">Built on Solana</span>
        </div>
        <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Trade stocks when <span className="sol-text">Wall Street sleeps.</span>
        </h1>
        <p className="text-muted mt-5 max-w-2xl text-lg leading-relaxed">
          Real stocks, tokenized, trade on Solana around the clock. After Hours shows you which ones are
          trading right now, whether the price is fresh, how far it has drifted from the last real print,
          and what a buy would actually cost. Then you buy from your own wallet.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link href="/stocks" className="sol-button inline-flex items-center rounded-md px-5 py-2.5 text-sm font-semibold">
            See what is trading now
          </Link>
          <span className="text-muted text-sm">
            {closed ? (
              <>
                Wall Street is closed. Opens {opensAt} ET, in {untilOpen}.{" "}
                <span className="text-ink font-medium">{data.rows.length} stocks</span> are trading onchain anyway.
              </>
            ) : (
              <>
                Wall Street is open. <span className="text-ink font-medium">{data.rows.length} stocks</span> trade
                onchain alongside it.
              </>
            )}
          </span>
        </div>
      </section>

      {/* Live preview */}
      <section className="mt-6">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="text-muted text-xs font-medium tracking-wide uppercase">Live right now</p>
            <div className="sol-rule mt-1.5" />
          </div>
          <Link href="/stocks" className="text-sm hover:underline">
            All {data.rows.length} stocks →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {preview.map((r) => (
            <Link
              key={r.underlying}
              href={`/stock/${r.underlying}`}
              className="border-line rounded-lg border bg-surface p-4 transition hover:border-ink"
            >
              <div className="flex items-baseline justify-between">
                <span className="font-medium">{r.name}</span>
                <span className="text-muted text-xs">{r.symbol}</span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="num text-lg">{formatUsd(r.price)}</span>
                <span className={`num text-sm ${tone(r.gapPct)}`}>{formatPct(r.gapPct)}</span>
              </div>
              <p className="text-muted mt-2 text-xs">
                vs {data.reference.phrase} · {TRADABILITY_LABEL[r.tradability]}
              </p>
            </Link>
          ))}
        </div>
        {movers.length > 0 && (
          <p className="text-muted mt-3 text-sm">
            Biggest moves since {data.reference.phrase}:{" "}
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
          </p>
        )}
      </section>

      {/* How it works */}
      <section id="how" className="mt-16">
        <p className="text-muted text-xs font-medium tracking-wide uppercase">How it works</p>
        <div className="sol-rule mt-1.5" />
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          <Step n="1" title="Pick a stock">
            Tesla, Nvidia, the S&P 500 and {data.rows.length - 3} more, issued onchain by regulated companies
            and backed one to one by real shares.
          </Step>
          <Step n="2" title="Check the price is real">
            Every price shows when it last traded, how deep the pool is, and how far it sits from the last
            Wall Street print. Stale or thin markets are flagged, never hidden.
          </Step>
          <Step n="3" title="Buy from your own wallet">
            Enter an amount, see the real cost including price impact, then sign in Phantom, Backpack or
            Solflare. The swap runs through Jupiter. We never hold your funds.
          </Step>
        </div>
      </section>

      {/* Why now */}
      <section className="mt-16 grid gap-8 sm:grid-cols-2">
        <div>
          <p className="text-muted text-xs font-medium tracking-wide uppercase">Why this exists</p>
          <div className="sol-rule mt-1.5" />
          <p className="mt-4 text-sm leading-relaxed">
            Brokerage apps close at 4 PM and stay shut all weekend. News does not. More than half of all
            tokenized-stock trading already happens outside US market hours, and Solana handles about 95
            percent of it. The catch: when Wall Street is closed, the onchain price floats on thin pools and
            can drift a few percent. Other apps show you a number and a buy button. We show you whether the
            number is real.
          </p>
        </div>
        <div>
          <p className="text-muted text-xs font-medium tracking-wide uppercase">What we will not do</p>
          <div className="sol-rule mt-1.5" />
          <ul className="mt-4 space-y-2 text-sm leading-relaxed">
            <li>Hold your money. Every trade is signed in your wallet.</li>
            <li>List a token with less than 50k USD of real liquidity.</li>
            <li>Call a price fresh when it last traded an hour ago.</li>
            <li>Call a weekend drift an opportunity. It is a drift.</li>
            <li>Pretend a synthetic pre-IPO token is a share. Those are not listed.</li>
          </ul>
        </div>
      </section>
    </>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="border-line rounded-lg border bg-surface p-5">
      <span className="sol-text num text-2xl font-semibold">{n}</span>
      <h3 className="mt-2 font-medium">{title}</h3>
      <p className="text-muted mt-2 text-sm leading-relaxed">{children}</p>
    </div>
  );
}

function tone(gap: number | null): string {
  if (gap == null || Math.abs(gap) < 0.25) return "text-muted";
  return gap > 0 ? "text-up" : "text-down";
}
