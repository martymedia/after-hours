"use client";

// Client-only loader for the limit-order panel (wallet hooks have no server half).

import dynamic from "next/dynamic";

export const OrderPanelLoader = dynamic(() => import("./order-panel").then((m) => m.OrderPanel), {
  ssr: false,
  loading: () => <div className="card-dark mt-5 h-40 animate-pulse" />,
});
