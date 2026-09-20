// What is being posted about a company, laid out the way a feed is: one
// poster per row, a handle, a time, the headline as the post, and what the
// crowd did with it underneath. Every field is real and comes from the
// Hacker News search, which is also why the note at the bottom says we
// neither pick these nor rank them. Server-safe, no client JavaScript.

import { ArrowBigUp, ArrowUpRight, MessageSquare } from "lucide-react";
import type { Story } from "@/lib/hn";
import { formatAgo } from "@/lib/format";

/** A story counts as fresh, and gets the dot, for half a day. */
const FRESH_MS = 12 * 3_600_000;

/**
 * The part of a hostname a reader would say out loud: "reuters" from
 * reuters.com, "ycombinator" from news.ycombinator.com, "bbc" from
 * bbc.co.uk. Used for the avatar letter and its colour, never shown
 * on its own, so an odd domain degrades to something harmless.
 */
function siteName(host: string): string {
  const parts = host.split(".").filter(Boolean);
  if (parts.length < 2) return host;
  const second = parts[parts.length - 2];
  const shared = ["co", "com", "org", "net", "ac", "gov", "edu"];
  if (parts.length > 2 && shared.includes(second)) return parts[parts.length - 3];
  return second;
}

/** A stable hue per source, so the same site keeps the same tile colour. */
function hueOf(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

function SourceAvatar({ host }: { host: string }) {
  const name = siteName(host);
  const hue = hueOf(name);
  return (
    <span
      aria-hidden="true"
      className="num relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold"
      style={{
        background: `hsl(${hue} 62% 94%)`,
        color: `hsl(${hue} 55% 34%)`,
        boxShadow: `inset 0 0 0 1px hsl(${hue} 45% 86%)`,
      }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

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
        {stories.map((s, i) => {
          const age = Math.max(0, now - s.ts);
          return (
            <li
              key={s.id}
              className="hover:bg-soft group relative flex gap-3 px-5 py-4 transition-colors sm:px-6"
            >
              {/* The thread line that makes a list read as a feed. */}
              {i < stories.length - 1 && (
                <span
                  aria-hidden="true"
                  className="bg-line absolute top-[3.4rem] bottom-0 left-[2.375rem] w-px sm:left-[2.625rem]"
                />
              )}
              <SourceAvatar host={s.source} />

              <div className="min-w-0 flex-1">
                <p className="num flex flex-wrap items-center gap-x-2 text-xs">
                  <span className="font-medium">{s.source}</span>
                  <span className="text-muted-2">·</span>
                  <span className="text-muted-2">{formatAgo(age)}</span>
                  {age < FRESH_MS && (
                    <span className="bg-blue h-1.5 w-1.5 rounded-full" />
                  )}
                </p>

                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block leading-snug font-medium group-hover:underline"
                >
                  {s.title}
                </a>

                <div className="text-muted num mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="bg-soft inline-flex items-center gap-1 rounded-full px-2 py-1">
                    <ArrowBigUp size={13} strokeWidth={1.75} />
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
