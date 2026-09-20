// What is being posted about a company, from Hacker News. Server-safe.

import { ArrowUpRight, MessageSquare, Newspaper } from "lucide-react";
import type { Story } from "@/lib/hn";
import { formatAgo } from "@/lib/format";

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
      className="card rise p-5 sm:p-6"
      style={{ "--i": 3 } as React.CSSProperties}
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="label-micro text-muted-2">Elsewhere</p>
          <h3 className="mt-1 flex items-center gap-2 text-xl font-semibold tracking-tight">
            <span className="icon-badge h-7 w-7">
              <Newspaper size={14} strokeWidth={1.75} />
            </span>
            What is being written about {name}
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
      </div>

      <ul className="mt-3 divide-y divide-line">
        {stories.map((s) => (
          <li key={s.id} className="py-3">
            <a
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="group block"
            >
              <span className="block font-medium group-hover:underline">
                {s.title}
              </span>
              <span className="text-muted num mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span>{s.source}</span>
                <span>{formatAgo(Math.max(0, now - s.ts))}</span>
                {s.points > 0 && <span>{s.points} points</span>}
              </span>
            </a>
            {s.comments > 0 && (
              <a
                href={s.discussion}
                target="_blank"
                rel="noreferrer"
                className="text-muted-2 hover:text-ink mt-1 inline-flex items-center gap-1 text-xs"
              >
                <MessageSquare size={11} strokeWidth={1.75} />
                {s.comments} comments
              </a>
            )}
          </li>
        ))}
      </ul>

      <p className="text-muted-2 mt-3 text-xs leading-relaxed">
        Every story whose headline names {name}, newest first, straight from the
        Hacker News search. We do not choose them, rank them or check them, and
        a story appearing here says nothing about whether the token is worth
        buying.
      </p>
    </section>
  );
}
