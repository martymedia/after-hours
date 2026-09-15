import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CurveBuilder } from "@/components/curve-builder";
import { CurveShape } from "@/components/curve-shape";

export const metadata: Metadata = {
  title: "Curve builder",
  description:
    "Launch a token on a Meteora bonding curve priced in a tokenized stock, anchored to the real Wall Street print. Set start and graduation in dollars, create it from your wallet.",
  alternates: { canonical: "/curves/build" },
  robots: { index: false, follow: true },
};

const STEPS = [
  {
    n: "1",
    title: "Pick the stock it is priced in",
    text: "Buyers pay in that stock token. SPYx, NVDAx, TSLAx and 36 more carry a Meteora badge.",
  },
  {
    n: "2",
    title: "Say where it starts and graduates, in dollars",
    text: "We convert through the stock's live onchain price, so the numbers mean what they say.",
  },
  {
    n: "3",
    title: "Create it from your wallet",
    text: "One transaction, validated by Meteora's SDK. The curve sells your token; at the target it graduates to an open pool.",
  },
];

export default function CurveBuildPage() {
  return (
    <div className="flex flex-col gap-5">
      <section className="card-dark overflow-hidden p-6 sm:p-8">
        <Link
          href="/curves"
          className="text-on-dark-muted inline-flex items-center gap-1 text-sm hover:text-white"
        >
          <ArrowLeft size={14} strokeWidth={1.75} /> Curves
        </Link>
        <div className="mt-3 grid items-center gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Launch a token priced in a real stock.
            </h2>
            <p className="text-on-dark-muted mt-3 max-w-xl leading-relaxed">
              A bonding curve sells your token at a rising price and needs no
              liquidity up front. Most launches quote in SOL at arbitrary caps.
              Here the quote is a tokenized stock and the curve is anchored to
              its real price, so &quot;start at $5,000, graduate at
              $50,000&quot; is exactly what happens.
            </p>
            <ol className="mt-5 grid gap-3 sm:grid-cols-3">
              {STEPS.map((s) => (
                <li key={s.n} className="rounded-2xl bg-white/10 p-3">
                  <div className="num text-blue-light text-xs font-semibold">
                    {s.n}
                  </div>
                  <div className="mt-1 text-sm font-medium leading-tight">
                    {s.title}
                  </div>
                  <div className="text-on-dark-muted mt-1 text-xs leading-relaxed">
                    {s.text}
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="text-on-dark-muted lg:col-span-5">
            <CurveShape
              startLabel="starts at $5k cap"
              endLabel="graduates at $50k"
              raiseLabel="price climbs with every buy"
              ratio={10}
              fill="#8fb3ff"
              progress={0.35}
            />
            <p className="mt-1 text-center text-[11px]">
              the shape of every curve built here: price against the stock
              raised
            </p>
          </div>
        </div>
      </section>
      <CurveBuilder />
    </div>
  );
}
