import Link from "next/link";
import { REPO_URL } from "@/lib/brand";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="text-muted mt-14 border-t border-line pt-5 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2">
          <Logo size={18} />
          <span>· built on Solana, trades via Jupiter</span>
        </span>
        <nav className="flex items-center gap-4">
          <Link href="/stocks" className="hover:text-ink">
            Stocks
          </Link>
          <Link href="/earnings" className="hover:text-ink">
            Earnings
          </Link>
          <Link href="/pre-ipo" className="hover:text-ink">
            Pre-IPO
          </Link>
          <Link href="/curves" className="hover:text-ink">
            Curves
          </Link>
          <Link href="/how" className="hover:text-ink">
            How it works
          </Link>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="hover:text-ink"
          >
            Source
          </a>
        </nav>
      </div>
      <p className="mt-3 leading-relaxed">
        A screener with a buy button. We never hold your funds. Nothing here is
        investment advice. Not available to US persons. Open source under the
        MIT licence: every quote, fee and transaction in this app can be read in
        the repository.
      </p>
    </footer>
  );
}
