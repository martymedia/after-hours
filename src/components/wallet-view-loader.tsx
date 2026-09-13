"use client";

// Loads the wallet page client-only: wallet detection has no server half.

import dynamic from "next/dynamic";

const skeleton = (
  <div className="flex flex-col gap-5">
    <div className="card-dark flex h-64 flex-col justify-center p-6 sm:p-8">
      <p className="text-on-dark-muted text-xs">Your wallet</p>
      <p className="num font-medium">Checking wallets…</p>
      <div className="mt-6 h-1 w-40 overflow-hidden rounded-full bg-white/10">
        <div className="t-shimmer h-full w-full bg-white/40" />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="card h-28 animate-pulse" />
      ))}
    </div>
    <div className="card h-64 animate-pulse" />
  </div>
);

export const WalletViewLoader = dynamic(
  () => import("./wallet-view").then((m) => m.WalletView),
  {
    ssr: false,
    loading: () => skeleton,
  },
);
