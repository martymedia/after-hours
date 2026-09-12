import type { Metadata } from "next";
import Link from "next/link";
import { ISSUERS, ISSUER_ORDER } from "@/lib/issuers";
import { getRadar } from "@/lib/radar";
import { formatAgo, formatUsd, gapTone, gapWords } from "@/lib/format";
import { TRADABILITY_LABEL, type Tradability } from "@/lib/radar-types";
import { SessionTimeline } from "@/components/session-timeline";
import { TickerBadge } from "@/components/ticker-badge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "How it works" };

const PILL: Record<Tradability, string> = {
  easy: "bg-soft-up text-up",
  ok: "bg-soft text-ink",
  thin: "bg-soft-warn text-warn",
  stale: "bg-soft-warn text-warn",
  none: "bg-soft text-muted",
};

export default function HowPage() {
  const data = getRadar();
  const sample = data.rows[0];
  const discount = [...data.rows].filter((r) => (r.gapPct ?? 0) < -0.25).sort((a, b) => (a.gapPct ?? 0) - (b.gapPct ?? 0))[0];
  const premium = [...data.rows].filter((r) => (r.gapPct ?? 0) > 0.25).sort((a, b) => (b.gapPct ?? 0) - (a.gapPct ?? 0))[0];
  const tileStock = discount ?? premium ?? sample;

  return (
    <div className="flex flex-col gap-16">
      {/* The day, explained by the clock itself */}
      <section className="card-dark p-6 sm:p-10">
        <p className="text-blue-light text-sm font-medium">How it works</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">
          Wall Street trades six and a half hours a day. Solana trades all of them.
        </h2>
        <p className="text-on-dark-muted mt-4 max-w-2xl leading-relaxed">
          Regulated issuers hold real shares with a custodian and put one token per share on Solana. Those
          tokens change hands in onchain pools every hour of the week. After Hours watches those pools,
          compares them with the last real Wall Street print, and lets you buy from your own wallet when the
          numbers make sense.
        </p>
        <SessionTimeline />
      </section>

      {/* The one number */}
      <section className="grid items-center gap-8 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="num text-blue text-[6rem] leading-none font-semibold tracking-tight sm:text-[8rem]">55%</div>
          <p className="mt-2 text-lg font-medium">of tokenized-stock trading already happens outside US market hours.</p>
          <p className="text-muted mt-1 text-sm">Blockworks and RWA.xyz, August 2026. About 95 percent of it settles on Solana.</p>
        </div>
        <div className="text-muted lg:col-span-7 lg:pl-8 lg:border-l lg:border-line">
          <p className="leading-relaxed">
            Brokerage apps close at four and stay dark all weekend. News does not: earnings land after the
            bell, headlines break on Sunday. The flip side is the reason this app exists. While Wall Street
            is closed the onchain price floats on thin pools and can drift a few percent from the last real
            print. Sometimes that is a discount, sometimes a premium, and most apps show you neither. They
            show a number and a buy button.
          </p>
        </div>
      </section>

      {/* Three steps, each with a live piece of the real app */}
      <section className="flex flex-col gap-12">
        <Step n="01" title="Pick a stock" text={`${data.rows.length} stocks with real onchain liquidity, issued by regulated companies and backed one to one by real shares. We show which company you are buying, which issuer wraps it how, and how deep the pool behind it is.`}>
          <div className="flex flex-wrap gap-2">
            {data.rows.slice(0, 12).map((r) => (
              <Link key={r.underlying} href={`/stock/${r.underlying}`} className="card flex items-center gap-2 py-1.5 pr-3 pl-1.5 text-sm transition hover:border-muted-2">
                <TickerBadge symbol={r.symbol} logo={r.logo} size={26} />
                {r.name}
              </Link>
            ))}
            <Link href="/stocks" className="text-muted self-center px-2 text-sm hover:text-ink">
              and {Math.max(0, data.rows.length - 12)} more
            </Link>
          </div>
        </Step>

        <Step n="02" title="Check the price is real" text="Every price carries the time of its last trade and its distance from the last Wall Street print. A stale price is labeled stale, a thin market thin. Blue means cheaper than Wall Street, red means pricier. The gap radar on each stock page shows how that distance moved over the last two days.">
          {sample && (
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <TickerBadge symbol={sample.symbol} logo={sample.logo} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{sample.name}</div>
                  <div className="text-muted text-xs">
                    {sample.symbol} · {sample.issuerName}
                  </div>
                </div>
                <span className={`pill ${PILL[sample.tradability]}`}>{TRADABILITY_LABEL[sample.tradability]}</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-muted text-xs">Onchain</div>
                  <div className="num font-semibold">{formatUsd(sample.price)}</div>
                </div>
                <div>
                  <div className="text-muted text-xs">{data.reference.short}</div>
                  <div className="num font-semibold">{formatUsd(sample.reference)}</div>
                </div>
                <div>
                  <div className="text-muted text-xs">Updated</div>
                  <div className="num font-semibold">{sample.ageMs == null ? "–" : formatAgo(sample.ageMs)}</div>
                </div>
              </div>
              <div className={`num mt-3 text-sm font-medium ${gapTone(sample.gapPct)}`}>
                {gapWords(sample.gapPct)} than {data.reference.phrase}. Live, right now.
              </div>
            </div>
          )}
        </Step>

        <Step n="03" title="Buy from your own wallet" text="Enter an amount. We fetch a real quote from Jupiter, including how much your order moves the pool, and say in one line whether you are getting the stock cheaper or dearer than on Wall Street. Then you sign in Phantom, Backpack or Solflare. We never touch your money.">
          {tileStock && (
            <div className="card p-4">
              <div className={`rounded-2xl p-4 text-white ${(tileStock.gapPct ?? 0) < 0 ? "bg-blue" : "bg-down"}`}>
                <div className="num text-2xl font-semibold">
                  {Math.abs(tileStock.gapPct ?? 0).toFixed(2)}% {(tileStock.gapPct ?? 0) < 0 ? "cheaper" : "more expensive"}
                </div>
                <div className="mt-0.5 text-sm text-white/80">
                  {tileStock.name} than {data.reference.phrase}, right now, before price impact.
                </div>
              </div>
              <Link href={`/stock/${tileStock.underlying}`} className="btn mt-3 w-full">
                Open {tileStock.name}
              </Link>
            </div>
          )}
        </Step>
      </section>

      {/* Issuers */}
      <section>
        <h3 className="text-xl font-semibold tracking-tight">Who issues the tokens</h3>
        <p className="text-muted mt-1 max-w-2xl text-sm">
          Same company, different wrappers. The legal structure decides what you actually hold, so we name it
          on every stock page.
        </p>
        <ul className="mt-5 divide-y divide-line border-y border-line">
          {ISSUER_ORDER.filter((id) => ISSUERS[id].enabled).map((id) => (
            <li key={id} className="grid gap-2 py-5 sm:grid-cols-12 sm:gap-6">
              <div className="sm:col-span-3">
                <div className="font-semibold">{ISSUERS[id].name}</div>
                <span className="pill mt-1 bg-soft text-ink">{ISSUERS[id].structureShort}</span>
              </div>
              <p className="text-muted text-sm leading-relaxed sm:col-span-9">{ISSUERS[id].structure}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* The rules, as a manifesto */}
      <section className="card-dark p-6 sm:p-10">
        <p className="text-blue-light text-sm font-medium">What we will not do</p>
        <ul className="mt-4 grid gap-x-10 gap-y-4 text-lg font-medium leading-snug sm:grid-cols-2">
          <li>Hold your money. Every trade is signed in your wallet.</li>
          <li>List a token with less than 50k USD of real liquidity.</li>
          <li>Call a price fresh when it last traded an hour ago.</li>
          <li>Call a weekend drift an opportunity without saying it can reverse at the open.</li>
          <li>Pretend a synthetic pre-IPO token is a share.</li>
          <li>Give investment advice. We show numbers and say what they mean.</li>
        </ul>
        <div className="mt-8">
          <Link href="/stocks" className="btn btn-white">
            See what is trading now
          </Link>
        </div>
      </section>
    </div>
  );
}

function Step({ n, title, text, children }: { n: string; title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:gap-10">
      <div className="lg:col-span-5">
        <div className="num text-blue text-sm font-semibold">{n}</div>
        <h3 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h3>
        <p className="text-muted mt-3 leading-relaxed">{text}</p>
      </div>
      <div className="lg:col-span-7">{children}</div>
    </div>
  );
}
