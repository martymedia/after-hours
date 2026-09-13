import type { Metadata } from "next";
import { RadarTable } from "@/components/radar-table";
import { Heatmap } from "@/components/heatmap";
import { getRadar } from "@/lib/radar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stocks trading now",
  description:
    "Every tokenized stock with a real market on Solana: onchain price, last Wall Street close, the gap between them, freshness and how easy it is to trade. Sorted by the biggest discount.",
  alternates: { canonical: "/stocks" },
};

export default function StocksPage() {
  const data = getRadar();
  return (
    <div className="flex flex-col gap-5">
      <Heatmap rows={data.rows} referencePhrase={data.reference.phrase} />
      <RadarTable initial={data} />
    </div>
  );
}
