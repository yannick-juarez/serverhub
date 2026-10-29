import { useId, type ComponentPropsWithRef } from "react";

type CheckboxProps = Omit<ComponentPropsWithRef<"input">, "type" | "className"> & {
  label: string;
  description?: string;
  className?: string;
};

export default function Checkbox({ label, description, id, className = "", disabled, ...props }: CheckboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = `${inputId}-description`;

  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <input
        {...props}
        id={inputId}
        type="checkbox"
        disabled={disabled}
        aria-describedby={description ? descriptionId : props["aria-describedby"]}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-white/20 bg-white/10 accent-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50"
      />
      <div>
        <label htmlFor={inputId} className={`text-xs font-medium text-slate-100 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
          {label}
        </label>
        {description ? <p id={descriptionId} className="mt-1 text-xs text-slate-400">{description}</p> : null}
      </div>
    </div>
  );
}
