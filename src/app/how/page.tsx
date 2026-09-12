import type { Metadata } from "next";
import Link from "next/link";
import { Search, ShieldCheck, Wallet, Clock, Layers, Ban } from "lucide-react";
import { ISSUERS, ISSUER_ORDER } from "@/lib/issuers";
import { getRadar } from "@/lib/radar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "How it works" };

export default function HowPage() {
  const data = getRadar();

  return (
    <div className="flex flex-col gap-5">
      <section className="card-dark p-6 sm:p-8">
        <p className="text-blue-light text-sm font-medium">How it works</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Stocks do not stop at the closing bell anymore.
        </h2>
        <p className="text-on-dark-muted mt-4 max-w-2xl leading-relaxed">
          Regulated issuers hold real shares with a custodian and put a token for each one on Solana. Those
          tokens trade in onchain pools every hour of the week. After Hours reads those pools, compares them
          with the last real Wall Street print, and lets you buy with your own wallet when the numbers make
          sense.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Step icon={Search} n="Pick a stock">
          {data.rows.length} stocks with real onchain liquidity: Tesla, Nvidia, the S&amp;P 500, Micron, SpaceX
          and more. We show which company you are buying, which issuer wraps it, and how deep the pool is.
        </Step>
        <Step icon={ShieldCheck} n="Check the price is real">
          Every price carries the time of its last trade and its distance from the last Wall Street print. A
          stale price is labeled stale, a thin market thin. The gap radar shows how the difference moved over
          the last two days.
        </Step>
        <Step icon={Wallet} n="Buy from your own wallet">
          Enter an amount. We fetch a real quote from Jupiter, including how much your order moves the pool,
          and say in one line whether you are getting the stock cheaper or dearer than on Wall Street. Then you
          sign in Phantom, Backpack or Solflare.
        </Step>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-6">
          <div className="flex items-center gap-2.5">
            <span className="icon-badge h-8 w-8">
              <Clock size={15} strokeWidth={1.75} />
            </span>
            <h3 className="font-semibold">Why the hours matter</h3>
          </div>
          <p className="text-muted mt-3 text-sm leading-relaxed">
            Nasdaq and NYSE trade from 9:30 to 16:00 New York time, five days a week. Brokerage apps add a few
            extended hours and then go dark until Monday. News does not wait: earnings land after the close,
            headlines break on Sunday. More than half of all tokenized-stock volume already happens outside US
            market hours, almost all of it on Solana.
          </p>
          <p className="text-muted mt-3 text-sm leading-relaxed">
            The flip side: while Wall Street is closed, the onchain price floats on thin pools and can drift a
            few percent from the last real print. That drift is the reason After Hours exists. Sometimes it is
            a discount, sometimes it is a premium, and we show you which.
          </p>
        </section>

        <section className="card p-6">
          <div className="flex items-center gap-2.5">
            <span className="icon-badge h-8 w-8">
              <Layers size={15} strokeWidth={1.75} />
            </span>
            <h3 className="font-semibold">Who issues the tokens</h3>
          </div>
          <ul className="mt-3 divide-y divide-line">
            {ISSUER_ORDER.filter((id) => ISSUERS[id].enabled).map((id) => (
              <li key={id} className="py-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium">{ISSUERS[id].name}</span>
                  <span className="pill bg-soft text-ink">{ISSUERS[id].structureShort}</span>
                </div>
                <p className="text-muted mt-1 text-sm leading-relaxed">{ISSUERS[id].structure}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card p-6">
        <div className="flex items-center gap-2.5">
          <span className="icon-badge h-8 w-8">
            <Ban size={15} strokeWidth={1.75} />
          </span>
          <h3 className="font-semibold">What we will not do</h3>
        </div>
        <ul className="mt-3 grid gap-x-8 gap-y-2 text-sm leading-relaxed sm:grid-cols-2">
          <li>Hold your money. Every trade is signed in your wallet, and the swap runs through Jupiter.</li>
          <li>List a token with less than 50k USD of real onchain liquidity.</li>
          <li>Call a price fresh when it last traded an hour ago.</li>
          <li>Call a weekend drift an opportunity without saying it can reverse at the open.</li>
          <li>Pretend a synthetic pre-IPO token is a share. Those are not listed.</li>
          <li>Give investment advice. We show numbers and say what they mean.</li>
        </ul>
        <div className="mt-6">
          <Link href="/stocks" className="btn">
            See what is trading now
          </Link>
        </div>
      </section>
    </div>
  );
}

function Step({ icon: Icon, n, children }: { icon: typeof Search; n: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <span className="icon-badge h-9 w-9">
        <Icon size={16} strokeWidth={1.75} />
      </span>
      <h3 className="mt-4 font-semibold">{n}</h3>
      <p className="text-muted mt-2 text-sm leading-relaxed">{children}</p>
    </div>
  );
}
