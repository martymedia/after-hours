"use client";

// "Follow a wallet by address": for browsers without a wallet, above all
// the Home Screen icon on iPhones, which is where push notifications live.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BASE58, followWallet } from "@/lib/followed";

export function FollowWalletForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const address = text.trim();
  const valid = BASE58.test(address);
  return (
    <form
      className="relative mx-auto mt-8 max-w-xs border-t border-white/10 pt-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        followWallet(address);
        router.push(`/wallet/${address}`);
      }}
    >
      <p className="text-on-dark-muted text-sm">No wallet in this browser? Follow one by address.</p>
      <p className="text-on-dark-muted mt-1 text-xs">Read-only, and the way to get notifications on an iPhone: paste the address here from the Home Screen icon.</p>
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Wallet address"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="num h-10 min-w-0 flex-1 rounded-full border border-white/15 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/40"
          aria-label="Wallet address"
        />
        <button type="submit" disabled={!valid} className="btn btn-white btn-sm shrink-0">
          Follow
        </button>
      </div>
    </form>
  );
}
