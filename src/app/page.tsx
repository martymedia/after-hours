import { RadarTable } from "@/components/radar-table";
import { getRadar } from "@/lib/radar";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const data = getRadar();
  return <RadarTable initial={data} />;
}
