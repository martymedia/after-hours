import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, HelpCircle } from "lucide-react";
import { Tip } from "./tip";

type Props = {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  /** Small muted line under the value. */
  detail?: React.ReactNode;
  /** Pill shown top right on wide cards, under the value on narrow ones. */
  badge?: React.ReactNode;
  /** Plain-words explanation behind a small (?) icon in the label row. */
  hint?: string;
  /** Makes the whole card a link. */
  href?: string;
  /** Stagger position for the entrance animation. */
  index?: number;
};

/** KPI card: icon badge and label on top, big value, a small note below. */
export function StatCard({ icon: Icon, label, value, detail, badge, hint, href, index = 0 }: Props) {
  const style = { "--i": index } as React.CSSProperties;
  const body = (
    <>
      <div className="flex min-w-0 items-center gap-2 text-xs font-medium sm:gap-2.5 sm:text-sm">
        <span className="icon-badge h-6 w-6 shrink-0 sm:h-7 sm:w-7">
          <Icon size={14} strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {hint && (
          <Tip text={hint} underline={false} className="text-muted-2 hover:text-ink shrink-0">
            <HelpCircle size={15} strokeWidth={1.75} />
          </Tip>
        )}
        {badge && <span className="hidden shrink-0 sm:inline-flex">{badge}</span>}
        {href && (
          <span className="text-muted-2 group-hover:text-ink hidden shrink-0 transition sm:inline-flex" aria-hidden="true">
            <ArrowUpRight size={15} strokeWidth={1.75} />
          </span>
        )}
      </div>
      <div>
        <div className="num text-xl leading-none font-semibold sm:text-[1.75rem]">{value}</div>
        {(detail || badge) && (
          <div className="text-muted mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm">
            {badge && <span className="sm:hidden">{badge}</span>}
            {detail && <span>{detail}</span>}
          </div>
        )}
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} style={style} className="card rise group flex flex-col gap-3 p-4 transition hover:border-muted-2 sm:gap-4 sm:p-5">
        {body}
      </Link>
    );
  }
  return (
    <div style={style} className="card rise flex flex-col gap-3 p-4 sm:gap-4 sm:p-5">
      {body}
    </div>
  );
}
