import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { getTrade } from "@/lib/trade";
import { formatUsd, gapTone, gapWords, shortAddress } from "@/lib/format";
import { TickerBadge } from "@/components/ticker-badge";

export const dynamic = "force-dynamic";

const SIG = /^[1-9A-HJ-NP-Za-km-z]{80,90}$/;
const when = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

type Props = {
  params: Promise<{ signature: string }>;
  searchParams: Promise<{ mint?: string }>;
};

function headline(
  t: NonNullable<Awaited<ReturnType<typeof getTrade>>>,
): string {
  const verb = t.kind === "bought" ? "Bought" : "Sold";
  const vs =
    t.vsRefPct == null || Math.abs(t.vsRefPct) < 0.25
      ? "in line with Wall Street"
      : `${Math.abs(t.vsRefPct).toFixed(1)}% ${t.vsRefPct < 0 ? "under" : "over"} Wall Street`;
  return `${verb} ${t.name} ${vs}`;
}

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { signature } = await params;
  const { mint } = await searchParams;
  if (!SIG.test(signature)) return { title: "Trade" };
  const t = await getTrade(signature, mint);
  if (!t) return { title: "Trade not found", robots: { index: false } };
  const title = headline(t);
  const description = `${trim(t.amount)} ${t.symbol} for ${formatUsd(t.usd)} at ${formatUsd(t.perShare)} per share, ${when.format(new Date(t.ts))} New York time, on Solana via After Hours.`;
  return {
    title,
    description,
    robots: { index: false, follow: true },
    alternates: {
      canonical: `/trade/${signature}${mint ? `?mint=${mint}` : ""}`,
    },
    openGraph: {
      title: `${title} | After Hours`,
      description,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | After Hours`,
      description,
    },
  };
}

/** A single trade as a page: the thing people share after a buy. */
export default async function TradePage({ params, searchParams }: Props) {
  const { signature } = await params;
  const { mint } = await searchParams;
  if (!SIG.test(signature)) notFound();
  const t = await getTrade(signature, mint);
  if (!t) notFound();
  const tone = gapTone(t.vsRefPct);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <section className="card-dark rise relative overflow-hidden p-6 sm:p-8">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-blue/30 blur-3xl"
        />
        <div className="relative flex items-center gap-4">
          <TickerBadge symbol={t.symbol} logo={t.logo} size={56} />
          <div className="min-w-0">
            <p className="text-on-dark-muted text-sm">
              {t.kind === "bought" ? "Bought" : "Sold"}
              {t.order ? " by limit order" : ""} on Solana,{" "}
              {when.format(new Date(t.ts))} ET
            </p>
            <h1 className="mt-0.5 truncate text-2xl font-semibold tracking-tight sm:text-3xl">
              {t.name}
            </h1>
          </div>
        </div>
        <div className="relative mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="text-on-dark-muted text-xs">
              {t.kind === "bought" ? "Shares" : "Sold"}
            </p>
            <p className="num mt-1 text-2xl font-semibold">{trim(t.amount)}</p>
            <p className="text-on-dark-muted text-xs">
              {t.symbol} · {t.issuerName}
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="text-on-dark-muted text-xs">
              {t.kind === "bought" ? "Paid" : "Received"}
            </p>
            <p className="num mt-1 text-2xl font-semibold">
              {formatUsd(t.usd)}
            </p>
            <p className="text-on-dark-muted text-xs">
              {formatUsd(t.perShare)} per share
            </p>
          </div>
        </div>
        {t.vsRefPct != null && (
          <p
            className={`relative mt-5 text-lg font-semibold ${tone === "text-muted" ? "text-on-dark-muted" : tone === "text-blue" ? "text-blue-light" : "text-down"}`}
          >
            {gapWords(t.vsRefPct) === "in line"
              ? "In line with Wall Street's last print at the time."
              : `${gapWords(t.vsRefPct)} than Wall Street's last print at the time.`}
          </p>
        )}
        <p className="text-on-dark-muted relative mt-2 text-xs">
          Wallet {shortAddress(t.owner)} · Swapped on Jupiter, signed in the
          owner&apos;s wallet. Nothing custodied.
        </p>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Link href={`/stock/${t.underlying}`} className="btn w-full">
          {t.kind === "bought" ? `Buy ${t.symbol} too` : `See ${t.symbol}`}
        </Link>
        <a
          href={`https://solscan.io/tx/${t.signature}`}
          target="_blank"
          rel="noreferrer"
          className="btn w-full border border-line bg-card text-ink hover:bg-soft"
        >
          Solscan
          <ArrowUpRight size={14} strokeWidth={1.75} className="ml-1.5" />
        </a>
      </div>
      <p className="text-muted text-center text-xs">
        <Link
          href={`/wallet/${t.owner}`}
          className="underline underline-offset-4 hover:text-ink"
        >
          See this wallet&apos;s other positions
        </Link>
      </p>
    </div>
  );
}

function trim(n: number): string {
  return n >= 100 ? n.toFixed(2) : n >= 1 ? n.toFixed(3) : n.toFixed(4);
}
