import { useState, type ReactNode } from "react";

type CollapsibleSectionProps = {
  title: string | ReactNode;
  children: ReactNode;
  isOpen?: boolean;
  defaultOpen?: boolean;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  headerRight?: ReactNode;
  onToggle?: (nextOpen: boolean) => void;
};

const CollapsibleSection = ({
  title,
  children,
  isOpen,
  defaultOpen = true,
  className = "",
  headerClassName = "",
  bodyClassName = "",
  headerRight,
  onToggle,
}: CollapsibleSectionProps) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const resolvedOpen = isOpen ?? internalOpen;
  const toggleOpen = () => {
    const nextOpen = !resolvedOpen;
    if (onToggle) {
      onToggle(nextOpen);
    }
    if (isOpen === undefined) {
      setInternalOpen(nextOpen);
    }
  };

  return (
    <section className={className + ' border border-white/10 rounded-lg'}>
      <div
        className={`flex w-full items-center justify-between gap-2 rounded-md p-2 text-left text-sm font-semibold capitalize text-slate-100 transition ${resolvedOpen ? '' : 'hover:bg-white/5'} ${headerClassName}`}
        onClick={toggleOpen}
        aria-expanded={resolvedOpen}
      >
        <span className="flex items-center gap-2 w-full">
          <button
            className={`rounded-lg border border-white/10 bg-white/10 p-0.5 text-slate-300 transition hover:bg-white/10`}
            type="button"
            aria-label={resolvedOpen ? "Hide details" : "Show details"}
            onClick={(e) => {
              e.stopPropagation();
              toggleOpen();
            }}
          >
            <svg
              className={`h-4 w-4 text-slate-300 transition-transform ${
                resolvedOpen ? "rotate-0" : "-rotate-90"
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M6 9L12 15L18 9"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
          </button>
          <div className="w-full">{title}</div>
        </span>
        <div className="flex flex-row items-center justify-center">
            {headerRight ? <span className="text-slate-400">{headerRight}</span> : null}
        </div>
      </div>
      {resolvedOpen ? <div className={bodyClassName}>{children}</div> : null}
    </section>
  );
};

export default CollapsibleSection;
