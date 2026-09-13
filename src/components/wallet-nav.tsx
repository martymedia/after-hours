"use client";

// "Wallet" entry for the rail and the phone tab bar. Renders nothing until a
// wallet is connected, so the menu stays the same for visitors.

import Link from "next/link";
import { Wallet } from "lucide-react";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { solanaClient } from "@/lib/solana-client";

type Props = { variant: "rail" | "tab"; expanded?: boolean; pathname: string };

export function WalletNavLink({ variant, expanded = true, pathname }: Props) {
  const connected = useConnectedWallet(solanaClient);
  if (!connected) return null;
  const active = pathname.startsWith("/wallet");

  if (variant === "tab") {
    return (
      <Link href="/wallet" className={`flex flex-col items-center gap-1 rounded-xl px-3 py-1 text-[11px] font-medium ${active ? "text-ink" : "text-muted"}`}>
        <span className={`icon-badge h-8 w-8 ${active ? "bg-ink text-white border-ink" : ""}`}>
          <Wallet size={16} strokeWidth={1.75} />
        </span>
        Wallet
      </Link>
    );
  }

  return (
    <Link
      href="/wallet"
      aria-label="Wallet"
      title={expanded ? undefined : "Wallet"}
      className={`flex items-center gap-3 rounded-full py-1.5 pr-3 pl-1 text-sm font-medium transition ${active ? "text-ink" : "text-muted hover:text-ink"}`}
    >
      <span className={`icon-badge h-10 w-10 shrink-0 ${active ? "bg-ink text-white border-ink" : ""}`}>
        <Wallet size={18} strokeWidth={1.75} />
      </span>
      {expanded && <span>Wallet</span>}
    </Link>
  );
}
