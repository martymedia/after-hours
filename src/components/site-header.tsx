import Link from "next/link";
import { Logo } from "./logo";

export function SiteHeader() {
  return (
    <header className="mb-6 flex items-center justify-between">
      <Link href="/" aria-label="After Hours home">
        <Logo size={28} />
      </Link>
      <nav className="flex items-center gap-6 text-sm font-medium">
        <Link href="/stocks" className="hover:underline">
          Stocks
        </Link>
        <Link href="/#how" className="text-muted hover:text-ink hidden sm:inline">
          How it works
        </Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="text-muted mt-20 border-t border-line pt-5 text-sm leading-relaxed">
      <p>
        After Hours runs on Solana and routes trades through Jupiter. It is a screener with a buy button; it
        never holds your funds. Nothing here is investment advice. Not available to US persons.
      </p>
    </footer>
  );
}
