"use client";

// Wallet entries for the shell. All render nothing until a wallet is
// connected, so the menu stays the same for visitors.
//   rail: its own group under a divider, with the short address as a tease
//   tab:  one more tab on phones
//   chip: small address pill in the top bar

import Link from "next/link";
import { Wallet } from "lucide-react";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { solanaClient } from "@/lib/solana-client";
import { shortAddress } from "./wallet-connect";

type Props = { variant: "rail" | "tab" | "chip"; expanded?: boolean; pathname: string };

export function WalletNavLink({ variant, expanded = true, pathname }: Props) {
  const connected = useConnectedWallet(solanaClient);
  if (!connected) return null;
  const address = connected.account.address;
  const active = pathname.startsWith("/wallet");

  if (variant === "chip") {
    return (
      <Link
        href="/wallet"
        className={`num hidden h-9 items-center gap-2 rounded-full border px-3 text-xs font-medium transition sm:flex ${
          active ? "border-ink bg-ink text-white" : "border-line bg-card text-muted hover:text-ink"
        }`}
        title="Your wallet"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-blue" />
        </span>
        {shortAddress(address)}
      </Link>
    );
  }

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
    <div className="mt-4 border-t border-line pt-4">
      {expanded && <p className="text-muted-2 mb-2 pl-2 text-[11px] font-medium">Your wallet</p>}
      <Link
        href="/wallet"
        aria-label="Wallet"
        title={expanded ? undefined : `Wallet ${shortAddress(address)}`}
        className={`flex items-center gap-3 rounded-full py-1.5 pr-3 pl-1 text-sm font-medium transition ${active ? "text-ink" : "text-muted hover:text-ink"}`}
      >
        <span className={`icon-badge relative h-10 w-10 shrink-0 ${active ? "bg-ink text-white border-ink" : ""}`}>
          <Wallet size={18} strokeWidth={1.75} />
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-blue" aria-hidden="true" />
        </span>
        {expanded && (
          <span className="flex flex-col leading-tight">
            <span>Wallet</span>
            <span className="num text-muted-2 text-[11px] font-normal">{shortAddress(address)}</span>
          </span>
        )}
      </Link>
    </div>
  );
}
