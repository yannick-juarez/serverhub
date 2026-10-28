import type { ComponentPropsWithRef } from "react";

type TitleProps = ComponentPropsWithRef<"h1"> & {
  as?: "h1" | "h2" | "h3";
};

export function Title({ as: Heading = "h1", className = "", ...props }: TitleProps) {
  return <Heading {...props} className={`text-2xl font-semibold tracking-tight text-white sm:text-3xl ${className}`} />;
}

export function Subtitle({ className = "", ...props }: ComponentPropsWithRef<"p">) {
  return <p {...props} className={`text-sm leading-relaxed text-slate-400 ${className}`} />;
}
