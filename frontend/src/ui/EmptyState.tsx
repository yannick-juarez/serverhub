import type { ReactNode } from "react";

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export default function EmptyState({ icon, title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center rounded-lg border border-dashed border-white/15 bg-white/5 px-6 py-8 text-center ${className}`}>
      {icon ? <div aria-hidden="true" className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-slate-300">{icon}</div> : null}
      <p className="text-sm font-semibold text-white">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-xs text-slate-400">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
