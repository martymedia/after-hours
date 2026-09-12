import type { Metadata } from "next";
import Link from "next/link";
import { listTokens, upcomingEarnings } from "@/lib/db";
import { nyYmd } from "@/lib/market-phase";
import { TickerBadge } from "@/components/ticker-badge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Earnings calendar" };

const dayHeading = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export default function EarningsPage() {
  const today = nyYmd();
  const tokens = listTokens();
  const nameOf = new Map<string, { name: string; symbol: string }>();
  for (const t of tokens) if (!nameOf.has(t.underlying)) nameOf.set(t.underlying, { name: t.name, symbol: t.symbol });
  const events = upcomingEarnings(today, 200).filter((e) => nameOf.has(e.symbol));

  const byDay = new Map<string, typeof events>();
  for (const e of events) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);

  // Six-week grid starting on the Monday of this week.
  const [y, m, d] = today.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const gridStart = addDays(today, -((weekday + 6) % 7));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  return (
    <div className="flex flex-col gap-5">
      <section className="card p-5">
        <h2 className="font-semibold">Earnings in the next 60 days</h2>
        <p className="text-muted mt-1 text-sm">
          Only stocks we track. Reports usually land after the closing bell, so the first market that reacts is
          the onchain one. Days with a report are marked blue.
        </p>
        <div className="mt-5 grid grid-cols-7 gap-1.5 text-center text-xs">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => (
            <div key={w} className="text-muted py-1 font-medium">
              {w}
            </div>
          ))}
          {cells.map((ymd) => {
            const items = byDay.get(ymd) ?? [];
            const isToday = ymd === today;
            const past = ymd < today;
            const dayNum = Number(ymd.slice(-2));
            const first = dayNum === 1;
            return (
              <div
                key={ymd}
                className={`flex min-h-16 flex-col items-start rounded-xl p-2 ${
                  items.length ? "bg-blue text-white" : past ? "text-muted-2" : "bg-soft"
                } ${isToday ? "ring-2 ring-ink" : ""}`}
              >
                <span className="num text-[11px] font-medium">{first ? monthLabel.format(new Date(`${ymd}T12:00:00Z`)).slice(0, 3) + " " : ""}{dayNum}</span>
                {items.map((e) => (
                  <Link key={e.symbol} href={`/stock/${e.symbol}`} className="mt-1 block truncate text-left text-[11px] font-medium hover:underline">
                    {nameOf.get(e.symbol)?.symbol ?? e.symbol}
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">By date</h2>
        {events.length === 0 ? (
          <p className="text-muted mt-2 text-sm">No reports scheduled in the next 60 days for the stocks we track.</p>
        ) : (
          <div className="mt-2 divide-y divide-line">
            {[...byDay.entries()].map(([date, items]) => (
              <div key={date} className="py-4">
                <h3 className="text-sm font-medium">{dayHeading.format(new Date(`${date}T12:00:00Z`))}</h3>
                <ul className="mt-2 flex flex-col gap-2">
                  {items.map((e) => {
                    const info = nameOf.get(e.symbol);
                    return (
                      <li key={e.symbol}>
                        <Link href={`/stock/${e.symbol}`} className="flex items-center gap-3 hover:opacity-80">
                          <TickerBadge symbol={info?.symbol ?? e.symbol} size={32} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">{info?.name ?? e.symbol}</span>
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
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
