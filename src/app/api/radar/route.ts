import { getRadar } from "@/lib/radar";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(getRadar(), {
    headers: { "cache-control": "no-store" },
  });
}
