"use client";

// App shell: icon rail on the left (desktop), top bar with title and stock
// search, bottom tab bar on phones. Mirrors the dashboard reference.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LineChart, BookOpen, Search } from "lucide-react";
import { Logo, LogoMark } from "./logo";
import { StockSearch } from "./stock-search";

const NAV = [
  { href: "/", label: "Overview", icon: Home, match: (p: string) => p === "/" },
  { href: "/stocks", label: "Stocks", icon: LineChart, match: (p: string) => p.startsWith("/stock") },
  { href: "/#how", label: "How it works", icon: BookOpen, match: () => false },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1400px]">
      {/* Rail */}
      <aside className="sticky top-0 hidden h-dvh w-20 shrink-0 flex-col items-center py-6 lg:flex">
        <Link href="/" aria-label="After Hours home">
          <LogoMark size={36} />
        </Link>
        <nav className="mt-10 flex flex-col gap-3">
          {NAV.map((n) => {
            const active = n.match(pathname);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-label={n.label}
                title={n.label}
                className={`icon-badge h-10 w-10 transition ${active ? "bg-ink text-white border-ink" : "hover:bg-soft"}`}
              >
                <n.icon size={18} strokeWidth={1.75} />
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col px-4 pb-24 sm:px-6 lg:pb-8 lg:pr-8">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-4 py-5">
          <Link href="/" className="lg:hidden" aria-label="After Hours home">
            <Logo size={32} />
          </Link>
          <h1 className="hidden text-2xl font-semibold tracking-tight lg:block">
            {pathname === "/" ? "Overview" : pathname.startsWith("/stock") ? "Stocks" : "After Hours"}
          </h1>
          <div className="flex items-center gap-3">
            <StockSearch />
            <span className="icon-badge h-9 w-9 lg:hidden" aria-hidden="true">
              <Search size={16} strokeWidth={1.75} />
            </span>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="text-muted mt-14 text-xs leading-relaxed">
          After Hours runs on Solana and routes trades through Jupiter. It is a screener with a buy button; it
          never holds your funds. Nothing here is investment advice. Not available to US persons.
        </footer>
      </div>

      {/* Bottom bar (phones) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-line bg-card/95 px-2 py-2 backdrop-blur lg:hidden">
        {NAV.map((n) => {
          const active = n.match(pathname);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex flex-col items-center gap-1 rounded-xl px-4 py-1.5 text-[11px] font-medium ${
                active ? "text-ink" : "text-muted"
              }`}
            >
              <span className={`icon-badge h-8 w-8 ${active ? "bg-ink text-white border-ink" : ""}`}>
                <n.icon size={16} strokeWidth={1.75} />
              </span>
              {n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
