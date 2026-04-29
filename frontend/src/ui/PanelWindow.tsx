import { useState, type ReactNode } from "react";

type PanelWindowProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  titleClassName?: string;
  bodyClassName?: string;
  headerRight?: ReactNode;
  collapsible?: boolean;
};

const PanelWindow = ({
  title,
  onClose,
  children,
  className = "",
  headerClassName = "",
  titleClassName = "",
  bodyClassName = "",
  headerRight,
  collapsible = false,
}: PanelWindowProps) => {

  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className={className}>
      <div
        className={`flex items-center justify-between border-b border-white/10 ${headerClassName}`}
      >
        { collapsible ? (
          <button
            className={`rounded-lg border border-white/10 bg-white/10 p-0.5 text-slate-300 transition hover:bg-white/10`}
            type="button"
            aria-label={isCollapsed ? "Show details" : "Hide details"}
            onClick={(e) => {
              e.stopPropagation();
              setIsCollapsed(!isCollapsed);
            }}
          >
            <svg
              className={`h-4 w-4 text-slate-300 transition-transform ${
                !isCollapsed ? "rotate-0" : "-rotate-90"
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
        ) : null}
        <div className={`text-sm font-semibold text-white ${titleClassName}`}>
          {title}
        </div>
        <div className="flex items-center gap-1">
          {headerRight}
          <button
            className="rounded-md text-[10px] uppercase tracking-[0.12em] text-slate-300"
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
      {!isCollapsed && <div className={bodyClassName}>{children}</div>}
    </div>
  );
};

export default PanelWindow;
