import { useId } from "react";

type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

type SegmentedControlProps<T extends string> = {
  label: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  className?: string;
};

export default function SegmentedControl<T extends string>({ label, value, options, onChange, className = "" }: SegmentedControlProps<T>) {
  const name = useId();

  return (
    <fieldset className={className}>
      <legend className="mb-2 text-xs font-medium text-slate-200">{label}</legend>
      <div className="inline-flex max-w-full flex-wrap rounded-xl border border-white/15 bg-white/5 p-1">
        {options.map((option) => (
          <label key={option.value} className={option.disabled ? "cursor-not-allowed" : "cursor-pointer"}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              disabled={option.disabled}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span className="block rounded-lg px-3 py-1.5 text-xs font-medium text-white/75 transition hover:bg-white/10 peer-checked:bg-white peer-checked:text-black peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-300 peer-disabled:opacity-40 peer-disabled:hover:bg-transparent">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
