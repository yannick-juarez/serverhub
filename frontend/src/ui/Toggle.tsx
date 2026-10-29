import { useId } from "react";

type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
};

export default function Toggle({ checked, onChange, label, description, disabled = false, className = "" }: ToggleProps) {
  const id = useId();
  const descriptionId = `${id}-description`;

  return (
    <div className={`flex items-start justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        <label htmlFor={id} className={`text-xs font-medium text-slate-100 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
          {label}
        </label>
        {description ? <p id={descriptionId} className="mt-1 text-xs text-slate-400">{description}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? descriptionId : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? "border-emerald-300/40 bg-emerald-500/30" : "border-white/15 bg-white/10"
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${
            checked ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
