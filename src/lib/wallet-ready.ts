"use client";

// Wallet readiness with a safety valve. The wallet plugin silently
// reconnects the remembered wallet on load and reports "not ready" until
// that answers. Phantom's in-app browser can leave that request hanging
// (for example while it blocks the domain), which would keep every
// connect button on "Checking wallets…" forever. After a few seconds we
// treat the wallet as ready so the user can connect by hand. The deadline
// is shared, so components that mount later do not wait again.

import { useEffect, useState } from "react";
import { useIsWalletReady } from "@solana/kit-plugin-wallet/react";
import { solanaClient } from "./solana-client";

const PATIENCE_MS = 4000;
let deadline: number | null = null;

export function useWalletReady(): boolean {
  const ready = useIsWalletReady(solanaClient);
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (ready) {
      deadline = null;
      return;
    }
    deadline ??= Date.now() + PATIENCE_MS;
    const id = setTimeout(() => setTimedOut(true), Math.max(0, deadline - Date.now()));
    return () => clearTimeout(id);
  }, [ready]);
  return ready || timedOut;
}
