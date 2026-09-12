import type { Metadata } from "next";
import { RadarTable } from "@/components/radar-table";
import { getRadar } from "@/lib/radar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Stocks trading now" };

export default function StocksPage() {
  const data = getRadar();
  return <RadarTable initial={data} />;
}
