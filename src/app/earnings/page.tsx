import type { Metadata } from "next";
import Link from "next/link";
import { listTokens, upcomingEarnings } from "@/lib/db";
import { nyYmd } from "@/lib/market-phase";
import { TickerBadge } from "@/components/ticker-badge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Earnings calendar" };

const longDate = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const shortMonth = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
const weekdayShort = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });
const monthYear = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

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

  const [y, m, d] = today.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const gridStart = addDays(today, -((weekday + 6) % 7));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  return (
    <div className="flex flex-col gap-16">
      {/* Why earnings matter after hours */}
      <section className="card-dark p-6 sm:p-10">
        <p className="text-blue-light text-sm font-medium">Earnings</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">
          Reports land after the bell. The onchain price reacts first.
        </h2>
        <p className="text-on-dark-muted mt-4 max-w-2xl leading-relaxed">
          Most companies publish results a few minutes after 4 PM New York time, when brokerages have already
          gone quiet. On Solana the same stock keeps trading, so the first market to price the news is the
          onchain one. Wall Street catches up at the next open, seventeen hours later.
        </p>

        {/* A typical earnings evening */}
        <div className="mt-8">
          <div className="relative h-3 rounded-full bg-blue/80">
            <div className="absolute inset-y-0 left-0 w-[18%] rounded-l-full bg-white" />
            <div className="absolute inset-y-0 right-0 w-[10%] rounded-r-full bg-white" />
            {[
              { at: 18, label: "4:00 PM", text: "closing bell" },
              { at: 21, label: "4:05 PM", text: "report drops" },
              { at: 24, label: "4:06 PM", text: "onchain moves" },
              { at: 90, label: "9:30 AM", text: "Wall Street opens" },
            ].map((p) => (
              <div key={p.label} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${p.at}%` }}>
                <div className="h-4 w-4 rounded-full border-[3px] border-ink bg-white" />
                <div className="absolute top-5 left-1/2 w-28 -translate-x-1/2 text-center">
                  <div className="num text-[11px] font-medium">{p.label}</div>
                  <div className="text-on-dark-muted text-[11px]">{p.text}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="h-12" />
          <p className="text-on-dark-muted text-xs">White: Wall Street open. Blue: After Hours, the onchain market is the only one trading.</p>
        </div>

        {/* Next report */}
        {next && (
          <div className="mt-8 flex flex-wrap items-center gap-4 rounded-2xl bg-white/10 p-4">
            <TickerBadge symbol={info.get(next.symbol)?.symbol ?? next.symbol} logo={info.get(next.symbol)?.logo} size={44} />
            <div className="min-w-0 flex-1">
              <div className="text-on-dark-muted text-xs">Next report in our universe</div>
              <div className="text-lg font-semibold">{info.get(next.symbol)?.name ?? next.symbol}</div>
              <div className="text-on-dark-muted text-sm">
                {longDate.format(at(next.date))}, {next.timing === "unknown" ? "time to be announced" : next.timing}
              </div>
            </div>
            <div className="text-right">
              <div className="num text-3xl font-semibold">{daysBetween(today, next.date)}</div>
              <div className="text-on-dark-muted text-xs">days away</div>
            </div>
            <Link href={`/stock/${next.symbol}`} className="btn btn-white btn-sm">
              Open {info.get(next.symbol)?.symbol ?? next.symbol}
            </Link>
          </div>
        )}
      </section>

      {/* Calendar */}
      <section>
        <div className="flex items-baseline justify-between">
          <h3 className="text-xl font-semibold tracking-tight">{monthYear.format(at(today))}</h3>
          <span className="text-muted text-sm">next six weeks, New York dates</span>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-2">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => (
            <div key={w} className="text-muted pb-1 text-center text-xs font-medium">
              {w}
            </div>
          ))}
          {cells.map((ymd) => {
            const items = byDay.get(ymd) ?? [];
            const isToday = ymd === today;
            const past = ymd < today;
            const wd = new Date(`${ymd}T12:00:00Z`).getUTCDay();
            const weekend = wd === 0 || wd === 6;
            const dayNum = Number(ymd.slice(-2));
            return (
              <div
                key={ymd}
                className={`flex min-h-20 flex-col rounded-2xl p-2 ${
                  items.length ? "bg-ink text-white" : past ? "bg-transparent text-muted-2" : weekend ? "bg-blue-soft" : "card"
                } ${isToday ? "ring-2 ring-blue ring-offset-2 ring-offset-bg" : ""}`}
              >
                <span className={`num text-xs font-medium ${items.length ? "text-white/80" : ""}`}>
                  {dayNum === 1 ? `${shortMonth.format(at(ymd))} ` : ""}
                  {dayNum}
                </span>
                <div className="mt-auto flex flex-col gap-1">
                  {items.map((e) => (
                    <Link key={e.symbol} href={`/stock/${e.symbol}`} className="flex items-center gap-1.5 text-xs font-medium hover:underline">
                      <TickerBadge symbol={info.get(e.symbol)?.symbol ?? e.symbol} logo={info.get(e.symbol)?.logo} size={18} />
                      <span className="truncate">{info.get(e.symbol)?.symbol ?? e.symbol}</span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-muted mt-3 text-xs">
          Black: a tracked stock reports that day. Light blue: weekend, onchain only. Blue ring: today.
        </p>
      </section>

      {/* Timeline list */}
      <section>
        <h3 className="text-xl font-semibold tracking-tight">Coming up</h3>
        {events.length === 0 ? (
          <p className="text-muted mt-2 text-sm">No reports scheduled in the next 60 days for the stocks we track.</p>
        ) : (
          <ol className="mt-4 border-l border-line">
            {[...byDay.entries()].map(([date, items]) => (
              <li key={date} className="relative pb-8 pl-8 last:pb-0">
                <span className="absolute top-1 -left-[7px] h-3.5 w-3.5 rounded-full border-[3px] border-blue bg-bg" />
                <div className="flex items-baseline gap-3">
                  <span className="num text-2xl font-semibold">{Number(date.slice(-2))}</span>
                  <span className="text-muted text-sm">
                    {weekdayShort.format(at(date))}, {shortMonth.format(at(date))} · in {daysBetween(today, date)} days
                  </span>
                </div>
                <ul className="mt-3 flex flex-col gap-2">
                  {items.map((e) => {
                    const i = info.get(e.symbol);
                    return (
                      <li key={e.symbol}>
                        <Link href={`/stock/${e.symbol}`} className="card flex items-center gap-3 p-3 transition hover:border-muted-2">
                          <TickerBadge symbol={i?.symbol ?? e.symbol} logo={i?.logo} size={36} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">{i?.name ?? e.symbol}</span>
                            <span className="text-muted block text-xs">{e.symbol}</span>
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
          </ol>
        )}
        <p className="text-muted mt-6 text-xs">Dates from Nasdaq&apos;s public earnings calendar, refreshed twice a day. Only stocks we track appear.</p>
      </section>
    </div>
  );
}
