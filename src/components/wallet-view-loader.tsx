"use client";

// Loads the wallet page client-only: wallet detection has no server half.

import dynamic from "next/dynamic";

const skeleton = (
  <div className="flex flex-col gap-5">
    <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="card h-28 animate-pulse" />
      ))}
    </div>
    <div className="card h-64 animate-pulse" />
  </div>
);

export const WalletViewLoader = dynamic(() => import("./wallet-view").then((m) => m.WalletView), {
  ssr: false,
  loading: () => skeleton,
});
