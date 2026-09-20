import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/brand";
import { listStockTokens } from "@/lib/db";
import { curvesOverview } from "@/lib/curves";
import { getPreIpo } from "@/lib/pre-ipo";

// Built per request: the stock list lives in the collector's database.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Pages whose numbers move with the market can honestly say "just now";
  // the explainers cannot, so they carry no date at all rather than a
  // fresh one on every fetch.
  const now = new Date();
  const stocks = [
    ...new Set(listStockTokens().map((t) => t.underlying)),
  ].sort();
  // The same source the curve pages read, so we never list one that 404s:
  // a stock whose only pools are hidden has no page.
  const withCurves = (await curvesOverview()).stocks
    .map((s) => s.underlying)
    .sort();
  const preIpo = (await getPreIpo()).rows.map((r) => r.underlying).sort();

  return [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/stocks`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/curves`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/pre-ipo`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/earnings`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.6,
    },
    { url: `${SITE_URL}/how`, changeFrequency: "monthly", priority: 0.5 },
    {
      url: `${SITE_URL}/curves/build`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    ...stocks.map((s) => ({
      url: `${SITE_URL}/stock/${s}`,
      lastModified: now,
      changeFrequency: "hourly" as const,
      priority: 0.8,
    })),
    ...preIpo.map((s) => ({
      url: `${SITE_URL}/pre-ipo/${s}`,
      lastModified: now,
      changeFrequency: "hourly" as const,
      priority: 0.7,
    })),
    ...withCurves.map((s) => ({
      url: `${SITE_URL}/curves/${s}`,
      lastModified: now,
      changeFrequency: "hourly" as const,
      priority: 0.6,
    })),
  ];
}
