import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/brand";
import { listTokens } from "@/lib/db";
import { listPools } from "@/lib/dbc-db";

// Built per request: the stock list lives in the collector's database.
export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  // Pages whose numbers move with the market can honestly say "just now";
  // the explainers cannot, so they carry no date at all rather than a
  // fresh one on every fetch.
  const now = new Date();
  const tokens = listTokens();
  const stocks = [...new Set(tokens.map((t) => t.underlying))].sort();
  const underlyingOf = new Map(tokens.map((t) => [t.mint, t.underlying]));
  const withCurves = [
    ...new Set(
      listPools()
        .map((p) => underlyingOf.get(p.quote_mint))
        .filter((u): u is string => Boolean(u)),
    ),
  ].sort();

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
    ...withCurves.map((s) => ({
      url: `${SITE_URL}/curves/${s}`,
      lastModified: now,
      changeFrequency: "hourly" as const,
      priority: 0.6,
    })),
  ];
}
