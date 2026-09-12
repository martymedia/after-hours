import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, HelpCircle } from "lucide-react";

type Props = {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  /** Small muted line under the value. */
  detail?: React.ReactNode;
  /** Pill shown top right, next to the label row. Never moves the value. */
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
      <div className="flex items-center gap-2.5 text-sm font-medium">
        <span className="icon-badge h-7 w-7">
          <Icon size={14} strokeWidth={1.75} />
        </span>
        <span className="flex-1">{label}</span>
        {hint && (
          <span className="group/hint relative inline-flex">
            <span tabIndex={0} className="text-muted-2 hover:text-ink cursor-help outline-none" aria-label={hint}>
              <HelpCircle size={15} strokeWidth={1.75} />
            </span>
            <span
              role="tooltip"
              className="pointer-events-none absolute top-full right-0 z-20 mt-1.5 hidden w-60 rounded-xl bg-ink px-3 py-2 text-left text-xs leading-relaxed font-normal text-white shadow-lg group-hover/hint:block group-focus-within/hint:block"
            >
              {hint}
            </span>
          </span>
        )}
        {badge}
        {href && (
          <span className="text-muted-2 group-hover:text-ink transition" aria-hidden="true">
            <ArrowUpRight size={15} strokeWidth={1.75} />
          </span>
        )}
      </div>
      <div>
        <div className="num text-[1.75rem] leading-none font-semibold">{value}</div>
        {detail && <div className="text-muted mt-1.5 text-sm">{detail}</div>}
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} style={style} className="card rise group flex flex-col gap-4 p-5 transition hover:border-muted-2">
        {body}
      </Link>
    );
  }
  return (
    <div style={style} className="card rise flex flex-col gap-4 p-5">
      {body}
    </div>
  );
}
