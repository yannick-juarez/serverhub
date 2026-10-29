import type { ReactNode } from "react";
import { HiOutlineCheckCircle, HiOutlineExclamationTriangle, HiOutlineInformationCircle, HiOutlineXCircle } from "react-icons/hi2";

type AlertTone = "info" | "success" | "warning" | "danger";

type AlertProps = {
  tone?: AlertTone;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
};

const toneConfig = {
  info: { classes: "border-sky-300/25 bg-sky-500/10 text-sky-100", icon: HiOutlineInformationCircle, iconClass: "text-sky-300" },
  success: { classes: "border-emerald-300/25 bg-emerald-500/10 text-emerald-100", icon: HiOutlineCheckCircle, iconClass: "text-emerald-300" },
  warning: { classes: "border-amber-300/25 bg-amber-500/10 text-amber-100", icon: HiOutlineExclamationTriangle, iconClass: "text-amber-300" },
  danger: { classes: "border-red-300/25 bg-red-500/10 text-red-100", icon: HiOutlineXCircle, iconClass: "text-red-300" },
};

export default function Alert({ tone = "info", title, children, action, className = "" }: AlertProps) {
  const { classes, icon: Icon, iconClass } = toneConfig[tone];

  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${classes} ${className}`}>
      <Icon aria-hidden="true" className={`mt-0.5 h-4 w-4 shrink-0 ${iconClass}`} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold">{title}</p>
        {children ? <div className="mt-1 text-xs text-white/70">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
