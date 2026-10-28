import type { ComponentPropsWithRef } from "react";

type ButtonProps = ComponentPropsWithRef<"button"> & {
  variant?: "primary" | "secondary" | "destructive";
  size?: "sm" | "md";
  loading?: boolean;
};

const variantClasses = {
  primary: "border-white bg-white text-black enabled:hover:bg-white/90 [&_svg]:text-emerald-700",
  secondary: "border-white/15 bg-white/5 text-slate-200 enabled:hover:bg-white/10",
  destructive: "border-red-300/30 bg-red-500/10 text-red-200 enabled:hover:bg-red-500/20",
};

const sizeClasses = {
  sm: "min-h-7 px-2.5 py-1 text-xs",
  md: "min-h-8 px-3 py-1.5 text-xs",
};

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  type = "button",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || props["aria-busy"]}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
        />
      )}
      {children}
    </button>
  );
}
