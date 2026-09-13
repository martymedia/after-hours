import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/brand";
import { listTokens } from "@/lib/db";

// Built per request: the stock list lives in the collector's database.
export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const stocks = [...new Set(listTokens().map((t) => t.underlying))].sort();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/stocks`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/earnings`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${SITE_URL}/how`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    ...stocks.map((s) => ({ url: `${SITE_URL}/stock/${s}`, lastModified: now, changeFrequency: "hourly" as const, priority: 0.8 })),
  ];
}
