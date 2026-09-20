"use client";

// App shell: collapsible icon rail on the left (desktop), top bar with title
// and stock search, bottom tab bar on phones.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Home,
  LineChart,
  CalendarDays,
  BookOpen,
  Orbit,
  Rocket,
  ChevronsLeft,
  ChevronsRight,
  ChevronUp,
  Search,
} from "lucide-react";
import { Logo, LogoMark } from "./logo";
import { StockSearch } from "./stock-search";
import { SiteFooter } from "./site-footer";
import { useSlidingPill } from "./motion";
import dynamic from "next/dynamic";

// Client-only: wallet entries depend on the browser's wallets.
const WalletNavLink = dynamic(
  () => import("./wallet-nav").then((m) => m.WalletNavLink),
  { ssr: false },
);

/**
 * The phone shows four of these and hides the rest behind a chevron. Six
 * across a 320px row left every label cramped, and a second row that opens
 * on demand costs nothing until someone wants it.
 */
const NAV = [
  {
    href: "/",
    label: "Overview",
    /** Short enough for a tab. */
    short: "Home",
    icon: Home,
    match: (p: string) => p === "/",
  },
  {
    href: "/stocks",
    label: "Stocks",
    icon: LineChart,
    match: (p: string) => p.startsWith("/stock"),
  },
  {
    href: "/earnings",
    label: "Earnings",
    icon: CalendarDays,
    match: (p: string) => p.startsWith("/earnings"),
    more: true,
  },
  {
    href: "/pre-ipo",
    label: "Pre-IPO",
    icon: Rocket,
    match: (p: string) => p.startsWith("/pre-ipo"),
  },
  {
    href: "/curves",
    label: "Curves",
    icon: Orbit,
    match: (p: string) => p.startsWith("/curves"),
  },
  {
    href: "/how",
    label: "How it works",
    short: "How",
    icon: BookOpen,
    match: (p: string) => p.startsWith("/how"),
    more: true,
  },
];

function TabLink({
  n,
  active,
  pillTarget,
}: {
  n: (typeof NAV)[number];
  active: boolean;
  pillTarget: boolean;
}) {
  return (
    <Link
      href={n.href}
      className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-1 text-[10px] font-medium ${
        active ? "text-ink" : "text-muted"
      }`}
    >
      <span
        data-pill-target={pillTarget ? n.href : undefined}
        className={`icon-badge relative z-[1] h-8 w-8 ${active && pillTarget ? "border-transparent bg-transparent text-white" : ""}`}
      >
        <n.icon size={16} strokeWidth={1.75} />
      </span>
      <span className="max-w-full truncate">{n.short ?? n.label}</span>
    </Link>
  );
}

const TITLES: [(p: string) => boolean, string][] = [
  [(p) => p === "/", "Overview"],
  [(p) => p.startsWith("/stock"), "Stocks"],
  [(p) => p.startsWith("/earnings"), "Earnings"],
  [(p) => p.startsWith("/pre-ipo"), "Pre-IPO"],
  [(p) => p.startsWith("/curves"), "Curves"],
  [(p) => p.startsWith("/how"), "How it works"],
  [(p) => p.startsWith("/wallet"), "Wallet"],
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
  const activeTab =
    NAV.find((n) => n.match(pathname))?.href ??
    (pathname.startsWith("/wallet") ? "/wallet" : null);
  const [moreTouched, setMoreTouched] = useState<boolean | null>(null);
  const activeInMore = NAV.some((n) => n.more && n.match(pathname));
  const moreOpen = moreTouched ?? activeInMore;
  const { bar: tabBarRef, pill: tabPillRef } = useSlidingPill(activeTab, [
    moreOpen,
  ]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1440px]">
      {/* Rail */}
      <aside
        className={`sticky top-0 hidden h-dvh shrink-0 flex-col py-6 pl-5 transition-[width] duration-200 lg:flex ${
          expanded ? "w-56" : "w-24"
        }`}
      >
        <Link
          href="/"
          aria-label="After Hours home"
          className="flex h-9 items-center px-1"
        >
          {expanded ? <Logo size={30} /> : <LogoMark size={32} />}
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
                <span
                  className={`icon-badge h-10 w-10 shrink-0 ${active ? "bg-ink text-white border-ink" : ""}`}
                >
                  <n.icon size={18} strokeWidth={1.75} />
                </span>
                {expanded && <span>{n.label}</span>}
              </Link>
            );
          })}
          <WalletNavLink
            variant="rail"
            expanded={expanded}
            pathname={pathname}
          />
        </nav>
        <button
          type="button"
          onClick={toggle}
          aria-label={expanded ? "Collapse menu" : "Expand menu"}
          className="icon-badge text-muted hover:text-ink mt-auto ml-1 h-9 w-9"
        >
          <span className="t-icon-swap" data-state={expanded ? "a" : "b"}>
            <span className="t-icon" data-icon="a">
              <ChevronsLeft size={16} strokeWidth={1.75} />
            </span>
            <span className="t-icon" data-icon="b">
              <ChevronsRight size={16} strokeWidth={1.75} />
            </span>
          </span>
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col px-4 pb-24 sm:px-6 lg:pb-8 lg:pr-8 lg:pl-6">
        <header className="flex items-center justify-between gap-4 py-5">
          <Link
            href="/"
            className="shrink-0 lg:hidden"
            aria-label="After Hours home"
          >
            <Logo size={30} />
          </Link>
          <h1 className="hidden text-2xl font-semibold tracking-tight lg:block">
            {title}
          </h1>
          <div className="flex items-center gap-3">
            <WalletNavLink variant="chip" pathname={pathname} />
            <StockSearch />
            <Link
              href="/stocks#find"
              className="icon-badge h-9 w-9 sm:hidden"
              aria-label="Search stocks"
            >
              <Search size={16} strokeWidth={1.75} />
            </Link>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <SiteFooter />
      </div>

      {/* Bottom bar (phones): four tabs, and a chevron for the rest */}
      <nav
        ref={tabBarRef}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 px-0.5 py-2 backdrop-blur lg:hidden"
      >
        <span ref={tabPillRef} className="t-tabbar-pill" aria-hidden="true" />
        <div className="tab-more" data-open={moreOpen}>
          <div>
            <div className="flex justify-around pb-2">
              {NAV.filter((n) => n.more).map((n) => (
                <TabLink
                  key={n.href}
                  n={n}
                  active={n.match(pathname)}
                  // Collapsed, this row has no height, so it must not be
                  // something the pill can try to sit on.
                  pillTarget={moreOpen}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-around">
          {NAV.filter((n) => !n.more).map((n) => (
            <TabLink key={n.href} n={n} active={n.match(pathname)} pillTarget />
          ))}
          <WalletNavLink variant="tab" pathname={pathname} />
          <button
            type="button"
            onClick={() => setMoreTouched(!moreOpen)}
            aria-expanded={moreOpen}
            aria-label={moreOpen ? "Fewer tabs" : "More tabs"}
            className="text-muted hover:text-ink flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-1 text-[10px] font-medium"
          >
            <span className="icon-badge relative z-[1] h-8 w-8">
              <ChevronUp
                size={16}
                strokeWidth={2}
                className={`transition-transform duration-200 ${moreOpen ? "rotate-180" : ""}`}
              />
            </span>
            {moreOpen ? "Less" : "More"}
          </button>
        </div>
      </nav>
    </div>
  );
}
