import type { Metadata } from "next";
import Link from "next/link";
import { listTokens, upcomingEarnings } from "@/lib/db";
import { nyYmd } from "@/lib/market-phase";
import { TickerBadge } from "@/components/ticker-badge";
import { Tip } from "@/components/tip";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Earnings calendar" };

const longDate = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const shortMonth = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
const weekdayShort = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400_000);
}
const at = (ymd: string) => new Date(`${ymd}T12:00:00Z`);

export default function EarningsPage() {
  const today = nyYmd();
  const tokens = listTokens();
  const info = new Map<string, { name: string; symbol: string; logo: string | null }>();
  for (const t of tokens) if (!info.has(t.underlying)) info.set(t.underlying, { name: t.name, symbol: t.symbol, logo: t.logo ?? null });
  const events = upcomingEarnings(today, 200).filter((e) => info.has(e.symbol));
  const byDay = new Map<string, typeof events>();
  for (const e of events) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  const next = events[0];
  const strip = Array.from({ length: 28 }, (_, i) => addDays(today, i));

  return (
    <div className="flex flex-col gap-10">
      {/* Title row */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Earnings</h2>
          <p className="text-muted mt-1 max-w-xl">
            When the stocks we track report. Results usually drop minutes after the 4 PM bell, and the onchain
            price is the first one to move.
          </p>
        </div>
        {next && (
          <Link href={`/stock/${next.symbol}`} className="card flex items-center gap-3 py-2 pr-4 pl-2 transition hover:border-muted-2">
            <TickerBadge symbol={info.get(next.symbol)?.symbol ?? next.symbol} logo={info.get(next.symbol)?.logo} size={36} />
            <span>
              <span className="text-muted block text-xs">Next up</span>
              <span className="block text-sm font-medium">
                {info.get(next.symbol)?.name ?? next.symbol} · in {daysBetween(today, next.date)} days
              </span>
            </span>
          </Link>
        )}
      </div>

      {/* Four weeks, two rows on desktop, four on phones. Every day is a link. */}
      <section className="grid grid-cols-7 gap-2 lg:grid-cols-[repeat(14,minmax(0,1fr))]">
        {strip.map((ymd, i) => {
          const items = byDay.get(ymd) ?? [];
          const date = at(ymd);
          const wd = date.getUTCDay();
          const weekend = wd === 0 || wd === 6;
          const isToday = i === 0;
          const firstOfMonth = Number(ymd.slice(-2)) === 1;
          const cls = `flex flex-col items-center rounded-2xl px-1 pt-3 pb-3 transition ${
            items.length ? "bg-ink text-white hover:bg-black" : weekend ? "bg-blue-soft hover:bg-blue/20" : "card hover:border-muted-2"
          } ${isToday ? "ring-2 ring-blue ring-offset-2 ring-offset-bg" : ""}`;
          const body = (
            <>
              <span className={`text-[10px] font-medium ${items.length ? "text-white/70" : "text-muted"}`}>
                {weekdayShort.format(date)}
              </span>
              <span className="num mt-0.5 text-xl font-semibold">
                {firstOfMonth ? <span className="text-xs font-medium">{shortMonth.format(date)} </span> : ""}
                {Number(ymd.slice(-2))}
              </span>
              <div className="mt-2 flex h-8 flex-col items-center justify-end gap-1">
                {items.length === 0 ? (
                  <span className={`h-1.5 w-1.5 rounded-full ${weekend ? "bg-blue/50" : "bg-line"}`} />
                ) : (
                  <span className="flex items-center -space-x-1">
                    {items.slice(0, 3).map((e) => (
                      <TickerBadge key={e.symbol} symbol={info.get(e.symbol)?.symbol ?? e.symbol} logo={info.get(e.symbol)?.logo} size={24} />
                    ))}
                    {items.length > 3 && (
                      <span className="num ml-1.5 rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold">+{items.length - 3}</span>
                    )}
                  </span>
                )}
              </div>
            </>
          );
          if (items.length) {
            return (
              <Link key={ymd} href={items.length === 1 ? `/stock/${items[0].symbol}` : `#day-${ymd}`} className={cls} title={items.map((e) => info.get(e.symbol)?.name ?? e.symbol).join(", ")}>
                {body}
              </Link>
            );
          }
          return (
            <Tip key={ymd} text={weekend ? "Weekend. Wall Street is closed; onchain keeps trading." : "No tracked stock reports this day."} underline={false} className="block">
              <span className={`${cls} w-full cursor-default`}>{body}</span>
            </Tip>
          );
        })}
      </section>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Agenda */}
        <section className="lg:col-span-7">
          <h3 className="font-semibold">Coming up</h3>
          {events.length === 0 ? (
            <p className="text-muted mt-2 text-sm">No reports in the next 60 days for the stocks we track.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {[...byDay.entries()].map(([date, items]) => (
                <li key={date} id={`day-${date}`} className="grid scroll-mt-24 grid-cols-[4.5rem_1fr] gap-4 py-4">
                  <div>
                    <div className="num text-2xl font-semibold leading-none">{Number(date.slice(-2))}</div>
                    <div className="text-muted mt-1 text-xs">
                      {weekdayShort.format(at(date))}, {shortMonth.format(at(date))}
                    </div>
                    <div className="text-blue mt-1 text-xs font-medium">in {daysBetween(today, date)} days</div>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {items.map((e) => {
                      const i = info.get(e.symbol);
                      return (
                        <li key={e.symbol}>
                          <Link href={`/stock/${e.symbol}`} className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-soft">
                            <TickerBadge symbol={i?.symbol ?? e.symbol} logo={i?.logo} size={40} />
                            <span className="min-w-0 flex-1">
                              <span className="block font-medium">{i?.name ?? e.symbol}</span>
                              <span className="text-muted block text-xs">
                                {i?.symbol ?? e.symbol} · {longDate.format(at(date))}
                              </span>
                            </span>
                            <span className={`pill ${e.timing === "after close" ? "pill-blue" : "bg-soft text-ink"}`}>
                              {e.timing === "unknown" ? "time tbd" : e.timing}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
          <p className="text-muted mt-4 text-xs">Dates from Nasdaq&apos;s public calendar, refreshed twice a day. Only tracked stocks appear.</p>
        </section>

        {/* An earnings evening, vertical */}
        <aside className="lg:col-span-5">
          <div className="card p-5">
            <h3 className="font-semibold">An earnings evening, minute by minute</h3>
            <ol className="mt-4 border-l-2 border-blue/30">
              {[
                ["4:00 PM", "Closing bell", "Brokerage apps stop taking orders for the day."],
                ["4:05 PM", "The report drops", "Revenue, profit, guidance. The stock is about to reprice."],
                ["4:06 PM", "Onchain moves", "The tokenized share trades on Solana and reacts within minutes. This is the After Hours window."],
                ["9:30 AM", "Wall Street opens", "Seventeen hours later the exchange catches up. The gap you saw overnight closes, or does not."],
              ].map(([time, title, text]) => (
                <li key={time} className="relative pb-5 pl-5 last:pb-0">
                  <span className="absolute top-1.5 -left-[7px] h-3 w-3 rounded-full bg-blue" />
                  <div className="num text-xs font-medium text-blue">{time}</div>
                  <div className="text-sm font-medium">{title}</div>
                  <div className="text-muted text-sm leading-relaxed">{text}</div>
                </li>
              ))}
            </ol>
            <p className="text-muted mt-4 text-xs leading-relaxed">
              A move on thin evening liquidity can overshoot. Check freshness and the gap radar on the stock page
              before you act on it.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
