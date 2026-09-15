import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CurveBuilder } from "@/components/curve-builder";

export const metadata: Metadata = {
  title: "Curve builder",
  description:
    "Build a Meteora Dynamic Bonding Curve priced in a tokenized stock, anchored to the real Wall Street print, validated by the SDK, created from your own wallet.",
  alternates: { canonical: "/curves/build" },
  robots: { index: false, follow: true },
};

export default function CurveBuildPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/curves"
          className="text-muted inline-flex items-center gap-1 text-sm hover:text-ink"
        >
          <ArrowLeft size={14} strokeWidth={1.75} /> Curves
        </Link>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">
          Build a curve anchored to a real price
        </h2>
        <p className="text-muted mt-1 max-w-2xl">
          A Meteora bonding curve quoted in a tokenized stock. You set where it
          starts and where it graduates in dollars; we convert through the
          stock&apos;s onchain price, run the SDK&apos;s validation, and hand
          you the configuration. Creating it is one transaction from your own
          wallet.
        </p>
      </div>
      <CurveBuilder />
    </div>
  );
}
