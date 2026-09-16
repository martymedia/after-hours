"use client";

// What the connected wallet holds, by mint. One call per wallet, shared by
// every list that marks the rows you already own.

import { useEffect, useState } from "react";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { solanaClient } from "./solana-client";

export function useHeldMints(): Record<string, number> {
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const connected = useConnectedWallet(solanaClient);
  const owner = connected?.account.address ?? null;
  useEffect(() => {
    if (!owner) {
      return;
    }
    let cancelled = false;
    fetch(`/api/balances?owner=${owner}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { amounts?: Record<string, number> } | null) => {
        if (!cancelled && b?.amounts) setAmounts(b.amounts);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [owner]);
  return owner ? amounts : {};
}
