import type { LucideIcon } from "lucide-react";
import { HelpCircle } from "lucide-react";

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
};

/** KPI card: icon badge and label on top, big value, a small note below. */
export function StatCard({ icon: Icon, label, value, detail, badge, hint }: Props) {
  return (
    <div className="card flex flex-col gap-4 p-5">
      <div className="flex items-center gap-2.5 text-sm font-medium">
        <span className="icon-badge h-7 w-7">
          <Icon size={14} strokeWidth={1.75} />
        </span>
        <span className="flex-1">{label}</span>
        {hint && (
          <span className="group relative inline-flex">
            <span tabIndex={0} className="text-muted-2 hover:text-ink cursor-help outline-none" aria-label={hint}>
              <HelpCircle size={15} strokeWidth={1.75} />
            </span>
            <span
              role="tooltip"
              className="pointer-events-none absolute top-full right-0 z-20 mt-1.5 hidden w-60 rounded-xl bg-ink px-3 py-2 text-left text-xs leading-relaxed font-normal text-white shadow-lg group-hover:block group-focus-within:block"
            >
              {hint}
            </span>
          </span>
        )}
        {badge}
      </div>
      <div>
        <div className="num text-[1.75rem] leading-none font-semibold">{value}</div>
        {detail && <div className="text-muted mt-1.5 text-sm">{detail}</div>}
      </div>
    </div>
  );
}
