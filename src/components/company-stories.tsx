// What is being posted about a company, laid out the way a feed is: one
// poster per row, a handle, a time, the headline as the post, and what the
// crowd did with it underneath. Every field is real and comes from the
// Hacker News search, which is also why the note at the bottom says we
// neither pick these nor rank them. Server-safe, no client JavaScript.

import {
  ArrowBigUp,
  ArrowUpRight,
  Clock3,
  FileText,
  MessageSquare,
  PlayCircle,
  Volume2,
} from "lucide-react";
import type { Story, Tag } from "@/lib/hn";
import { formatAgo } from "@/lib/format";

/** A story counts as fresh, and gets the marker, for half a day. */
const FRESH_MS = 12 * 3_600_000;

/**
 * The part of a hostname a reader would say out loud: "reuters" from
 * reuters.com, "ycombinator" from news.ycombinator.com, "bbc" from
 * bbc.co.uk. Used for the tile letter and its colour, never shown on its
 * own, so an odd domain degrades to something harmless.
 */
function siteName(host: string): string {
  const parts = host.split(".").filter(Boolean);
  if (parts.length < 2) return host;
  const second = parts[parts.length - 2];
  const shared = ["co", "com", "org", "net", "ac", "gov", "edu"];
  if (parts.length > 2 && shared.includes(second))
    return parts[parts.length - 3];
  return second;
}

/**
 * A fixed palette rather than a hue off a hash: hashing into the whole
 * circle clumps badly, and six rows came out four shades of purple. Each
 * entry is dark enough to carry white text and comes with the wash used
 * behind the loudest row.
 */
const PALETTE = [
  { ink: "#4f46e5", wash: "#eef0fe" },
  { ink: "#e11d48", wash: "#fdecf1" },
  { ink: "#0d9488", wash: "#e8f6f4" },
  { ink: "#ea580c", wash: "#fdefe6" },
  { ink: "#0284c7", wash: "#e7f3fb" },
  { ink: "#7c3aed", wash: "#f2ecfe" },
  { ink: "#059669", wash: "#e7f5ef" },
  { ink: "#c026d3", wash: "#fbeafd" },
  { ink: "#ca8a04", wash: "#fbf4e2" },
  { ink: "#2563eb", wash: "#eaf1fe" },
];

/** A stable slot per source, so the same site keeps the same colour. */
function slotOf(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % PALETTE.length;
}

const TAG_STYLE: Record<Tag, { className: string; icon: React.ReactNode }> = {
  video: {
    className: "bg-soft-down text-down",
    icon: <PlayCircle size={11} strokeWidth={2} />,
  },
  pdf: {
    className: "bg-soft-warn text-warn",
    icon: <FileText size={11} strokeWidth={2} />,
  },
  audio: {
    className: "bg-blue-soft text-blue",
    icon: <Volume2 size={11} strokeWidth={2} />,
  },
  year: {
    className: "bg-soft text-muted",
    icon: <Clock3 size={11} strokeWidth={2} />,
  },
};

export function CompanyStories({
  name,
  stories,
  now,
}: {
  name: string;
  stories: Story[];
  now: number;
}) {
  if (stories.length === 0) return null;
  // One row carries the weight, and it is the one the crowd pushed hardest.
  // Only when it is a clear winner: a tie tells the reader nothing.
  const loudest = stories.reduce((a, b) => (b.points > a.points ? b : a));
  const alone = stories.filter((s) => s.points === loudest.points).length === 1;
  const highlight = alone && loudest.points >= 3 ? loudest.id : null;

  // Two different sources landing on the same slot next to each other looks
  // like a mistake, so the second one steps along the palette. The same
  // source keeps its colour, which is the point of hashing in the first place.
  const taken = new Map<string, number>();
  const rows = stories.map((s, i) => {
    const site = siteName(s.source);
    let slot = taken.get(site);
    if (slot == null) {
      slot = slotOf(site);
      const before = i > 0 ? taken.get(siteName(stories[i - 1].source)) : null;
      if (before === slot) slot = (slot + 1) % PALETTE.length;
      taken.set(site, slot);
    }
    return { s, site, ...PALETTE[slot] };
  });

  return (
    <section
      className="card rise overflow-hidden p-0"
      style={{ "--i": 3 } as React.CSSProperties}
    >
      <header className="border-line flex flex-wrap items-end justify-between gap-2 border-b px-5 py-4 sm:px-6">
        <div>
          <p className="label-micro text-muted-2">Elsewhere</p>
          <h3 className="mt-1 text-xl font-semibold tracking-tight">
            {name} in the feed
          </h3>
        </div>
        <a
          href={`https://hn.algolia.com/?query=${encodeURIComponent(name)}&type=story&sort=byDate`}
          target="_blank"
          rel="noreferrer"
          className="text-muted-2 hover:text-ink inline-flex items-center gap-1 text-xs"
        >
          all of it on Hacker News
          <ArrowUpRight size={12} strokeWidth={2} />
        </a>
      </header>

      <ol className="divide-line divide-y">
        {rows.map(({ s, site, ink, wash }) => {
          const age = Math.max(0, now - s.ts);
          const top = s.id === highlight;
          return (
            <li
              key={s.id}
              className="group relative flex gap-3 py-4 pr-5 pl-6 transition-colors sm:pr-6 sm:pl-7"
              style={top ? { background: wash } : undefined}
            >
              {/* The coloured spine: same hue as the tile, so the eye
                  connects the row to the source without reading anything. */}
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 w-[3px]"
                style={{ background: ink, opacity: top ? 1 : 0.45 }}
              />

              <span
                aria-hidden="true"
                className="num flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white"
                style={{ background: ink }}
              >
                {site.slice(0, 1).toUpperCase()}
              </span>

              <div className="min-w-0 flex-1">
                <p className="num flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <span className="font-medium" style={{ color: ink }}>
                    {s.source}
                  </span>
                  <span className="text-muted-2">·</span>
                  <span className="text-muted-2">{formatAgo(age)}</span>
                  {age < FRESH_MS && (
                    <span className="pill bg-blue px-1.5 py-0 text-[0.625rem] text-white">
                      new
                    </span>
                  )}
                  {top && (
                    <span className="pill bg-soft-warn text-warn px-1.5 py-0 text-[0.625rem]">
                      most upvoted here
                    </span>
                  )}
                </p>

                <p className="mt-1 leading-snug">
                  {s.prefix && (
                    <span className="pill bg-ink mr-1.5 align-[0.1em] px-1.5 py-0 text-[0.625rem] text-white">
                      {s.prefix}
                    </span>
                  )}
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium group-hover:underline"
                  >
                    {s.title}
                  </a>
                  {s.tags.map((t) => (
                    <span
                      key={t.kind}
                      className={`pill ml-1.5 gap-1 align-[0.1em] px-1.5 py-0 text-[0.625rem] ${TAG_STYLE[t.kind].className}`}
                    >
                      {TAG_STYLE[t.kind].icon}
                      {t.label}
                    </span>
                  ))}
                </p>

                <div className="text-muted num mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#fff0e6] px-2 py-1 text-[#c2410c]">
                    <ArrowBigUp size={13} strokeWidth={2} />
                    {s.points}
                  </span>
                  <a
                    href={s.discussion}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-soft hover:text-ink inline-flex items-center gap-1 rounded-full px-2 py-1 transition-colors"
                  >
                    <MessageSquare size={12} strokeWidth={1.75} />
                    {s.comments}
                  </a>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-2 hover:text-ink ml-auto inline-flex items-center gap-1 transition-colors"
                  >
                    Read
                    <ArrowUpRight size={12} strokeWidth={2} />
                  </a>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="text-muted-2 border-line border-t px-5 py-3 text-xs leading-relaxed sm:px-6">
        Every story whose headline names {name}, newest first, straight from the
        Hacker News search. We do not choose them, rank them or check them, and a
        story appearing here says nothing about whether the token is worth
        buying.
      </p>
    </section>
  );
}
