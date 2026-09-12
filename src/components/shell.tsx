"use client";

// App shell: collapsible icon rail on the left (desktop), top bar with title
// and stock search, bottom tab bar on phones.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, LineChart, CalendarDays, BookOpen, ChevronsLeft, ChevronsRight, Search } from "lucide-react";
import { Logo, LogoMark } from "./logo";
import { StockSearch } from "./stock-search";
import { SiteFooter } from "./site-footer";

const NAV = [
  { href: "/", label: "Overview", icon: Home, match: (p: string) => p === "/" },
  { href: "/stocks", label: "Stocks", icon: LineChart, match: (p: string) => p.startsWith("/stock") },
  { href: "/earnings", label: "Earnings", icon: CalendarDays, match: (p: string) => p.startsWith("/earnings") },
  { href: "/how", label: "How it works", icon: BookOpen, match: (p: string) => p.startsWith("/how") },
];

const TITLES: [(p: string) => boolean, string][] = [
  [(p) => p === "/", "Overview"],
  [(p) => p.startsWith("/stock"), "Stocks"],
  [(p) => p.startsWith("/earnings"), "Earnings"],
  [(p) => p.startsWith("/how"), "How it works"],
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    // Read the saved preference after hydration so server and client agree.
    const id = requestAnimationFrame(() => {
      try {
        setExpanded(localStorage.getItem("rail") !== "closed");
      } catch {}
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    try {
      localStorage.setItem("rail", next ? "open" : "closed");
    } catch {}
  };

  const title = TITLES.find(([m]) => m(pathname))?.[1] ?? "After Hours";

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1440px]">
      {/* Rail */}
      <aside
        className={`sticky top-0 hidden h-dvh shrink-0 flex-col py-6 pl-5 transition-[width] duration-200 lg:flex ${
          expanded ? "w-56" : "w-24"
        }`}
      >
        <Link href="/" aria-label="After Hours home" className="flex items-center gap-3 px-1">
          <LogoMark size={36} />
          {expanded && <span className="font-semibold tracking-tight">After Hours</span>}
        </Link>
        <nav className="mt-10 flex flex-col gap-2">
          {NAV.map((n) => {
            const active = n.match(pathname);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-label={n.label}
                title={expanded ? undefined : n.label}
                className={`flex items-center gap-3 rounded-full py-1.5 pr-3 pl-1 text-sm font-medium transition ${
                  active ? "text-ink" : "text-muted hover:text-ink"
                }`}
              >
                <span className={`icon-badge h-10 w-10 shrink-0 ${active ? "bg-ink text-white border-ink" : ""}`}>
                  <n.icon size={18} strokeWidth={1.75} />
                </span>
                {expanded && <span>{n.label}</span>}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={toggle}
          aria-label={expanded ? "Collapse menu" : "Expand menu"}
          className="icon-badge text-muted hover:text-ink mt-auto ml-1 h-9 w-9"
        >
          {expanded ? <ChevronsLeft size={16} strokeWidth={1.75} /> : <ChevronsRight size={16} strokeWidth={1.75} />}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col px-4 pb-24 sm:px-6 lg:pb-8 lg:pr-8 lg:pl-6">
        <header className="flex items-center justify-between gap-4 py-5">
          <Link href="/" className="lg:hidden" aria-label="After Hours home">
            <Logo size={32} />
          </Link>
          <h1 className="hidden text-2xl font-semibold tracking-tight lg:block">{title}</h1>
          <div className="flex items-center gap-3">
            <StockSearch />
            <span className="icon-badge h-9 w-9 sm:hidden" aria-hidden="true">
              <Search size={16} strokeWidth={1.75} />
            </span>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <SiteFooter />
      </div>

      {/* Bottom bar (phones) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-line bg-card/95 px-1 py-2 backdrop-blur lg:hidden">
        {NAV.map((n) => {
          const active = n.match(pathname);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex flex-col items-center gap-1 rounded-xl px-3 py-1 text-[11px] font-medium ${
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
