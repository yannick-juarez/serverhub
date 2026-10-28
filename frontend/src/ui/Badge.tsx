import type { ComponentPropsWithRef } from "react";

type BadgeProps = ComponentPropsWithRef<"span"> & {
  tone?: "neutral" | "success" | "warning" | "danger";
};

const toneClasses = {
  neutral: "border-white/15 bg-white/5 text-slate-300",
  success: "border-emerald-300/30 bg-emerald-500/10 text-emerald-200",
  warning: "border-amber-300/30 bg-amber-500/10 text-amber-200",
  danger: "border-red-300/30 bg-red-500/10 text-red-200",
};

export default function Badge({ tone = "neutral", className = "", ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${toneClasses[tone]} ${className}`}
    />
  );
}
