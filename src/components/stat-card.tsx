import type { LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  badge?: React.ReactNode;
};

/** KPI card: icon badge plus label on top, big value, a small pill or note. */
export function StatCard({ icon: Icon, label, value, detail, badge }: Props) {
  return (
    <div className="card flex flex-col gap-5 p-5">
      <div className="flex items-center gap-2.5 text-sm font-medium">
        <span className="icon-badge h-7 w-7">
          <Icon size={14} strokeWidth={1.75} />
        </span>
        {label}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="num text-[1.75rem] leading-none font-semibold">{value}</span>
        {badge}
        {detail && <span className="text-muted text-sm">{detail}</span>}
      </div>
    </div>
  );
}
