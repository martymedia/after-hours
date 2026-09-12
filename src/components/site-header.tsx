import Link from "next/link";
import { Logo } from "./logo";

export function SiteHeader() {
  return (
    <header className="mb-10 flex items-center justify-between">
      <Link href="/" aria-label="After Hours home">
        <Logo size={30} />
      </Link>
      <nav className="flex items-center gap-5 text-sm">
        <Link href="/stocks" className="text-ink hover:underline">
          Stocks
        </Link>
        <Link href="/#how" className="text-muted hover:text-ink hidden sm:inline">
          How it works
        </Link>
        <span className="border-line inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs">
          <span className="sol-dot" />
          Built on Solana
        </span>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="text-muted mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-xs">
      <span>After Hours. Screener plus a buy button. We never hold your funds.</span>
      <span>Not investment advice. Not available to US persons.</span>
    </footer>
  );
}
