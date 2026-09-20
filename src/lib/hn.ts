// What people are posting about a private company. There is no licensed
// news feed behind these tokens, and we will not invent one, but Hacker
// News publishes a keyless search over everything submitted to it, with
// the source and the discussion attached. So we ask it for stories whose
// headline names the company, newest first, and say exactly that on the
// page: we do not choose them and we do not rank them.

const API = "https://hn.algolia.com/api/v1/search_by_date";
const TTL_MS = 20 * 60_000;
const MAX = 6;

/** What the poster attached: a talk, a paper, an old piece. */
export type Tag = "video" | "pdf" | "audio" | "year";

export type Story = {
  id: string;
  title: string;
  /** "Show HN", "Ask HN", "Launch HN", when the post is one of those. */
  prefix: string | null;
  tags: { kind: Tag; label: string }[];
  /** The article, or the discussion when the post has no link of its own. */
  url: string;
  discussion: string;
  source: string;
  ts: number;
  points: number;
  comments: number;
};

type Hit = {
  objectID: string;
  title: string | null;
  url: string | null;
  created_at: string;
  points: number | null;
  num_comments: number | null;
};

const cache = new Map<string, { ts: number; stories: Story[] }>();

/**
 * Hacker News puts the medium in the title: "A talk about X [video]",
 * "The paper [pdf]", "Something [2019]" for a repost of an old piece, and
 * "Show HN:" in front of what someone built. That is a convention, not part
 * of the headline, so we lift it out and let the page show it as a mark.
 */
const TRAILING = /\s*\[(video|pdf|audio|\d{4})\]\s*$/i;
const NOISE = /\s*\[(flagged|dupe|dead)\]\s*$/i;
const PREFIX = /^(Show|Ask|Tell|Launch) HN:\s*/i;

function readTitle(raw: string) {
  let title = raw.trim();
  const tags: { kind: Tag; label: string }[] = [];
  for (;;) {
    const noise = title.match(NOISE);
    if (noise) {
      title = title.slice(0, noise.index).trim();
      continue;
    }
    const m = title.match(TRAILING);
    if (!m) break;
    const found = m[1].toLowerCase();
    const kind: Tag = /^\d{4}$/.test(found) ? "year" : (found as Tag);
    // Leftmost wins on the page, and we are peeling from the right.
    tags.unshift({ kind, label: kind === "year" ? found : found.toUpperCase() });
    title = title.slice(0, m.index).trim();
  }
  const p = title.match(PREFIX);
  const prefix = p ? `${p[1][0].toUpperCase()}${p[1].slice(1).toLowerCase()} HN` : null;
  if (p) title = title.slice(p[0].length).trim();
  return { title, tags, prefix };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Stories whose title names the company. The word boundary matters: without
 * it "SpaceXAI" counts as SpaceX and "figure out how" counts as Figure AI.
 */
export async function companyStories(name: string): Promise<Story[]> {
  const key = name.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.stories;

  const url = `${API}?tags=story&hitsPerPage=50&restrictSearchableAttributes=title&query=${encodeURIComponent(name)}`;
  let stories: Story[] = [];
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(String(res.status));
    const body = (await res.json()) as { hits?: Hit[] };
    const named = new RegExp(`\\b${escapeRe(name)}\\b`, "i");
    const seen = new Set<string>();
    for (const h of body.hits ?? []) {
      if (!h.title || !named.test(h.title)) continue;
      // The same link gets submitted again and again; keep the first.
      const fingerprint = h.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
      if (seen.has(fingerprint)) continue;
      seen.add(fingerprint);
      const discussion = `https://news.ycombinator.com/item?id=${h.objectID}`;
      let source = "news.ycombinator.com";
      try {
        if (h.url) source = new URL(h.url).hostname.replace(/^www\./, "");
      } catch {
        // A malformed link stays pointed at the discussion.
      }
      const read = readTitle(h.title);
      if (!read.title) continue;
      stories.push({
        id: h.objectID,
        title: read.title,
        prefix: read.prefix,
        tags: read.tags,
        url: h.url ?? discussion,
        discussion,
        source,
        ts: Date.parse(h.created_at),
        points: h.points ?? 0,
        comments: h.num_comments ?? 0,
      });
      if (stories.length >= MAX) break;
    }
  } catch {
    // Their search being down is not our page being down.
    stories = hit?.stories ?? [];
  }
  cache.set(key, { ts: Date.now(), stories });
  return stories;
}
