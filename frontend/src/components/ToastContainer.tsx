import { useEffect } from "react";
import { HiOutlineXMark } from "react-icons/hi2";
import type { Toast } from "../hooks/useToast";

export function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  return (
    <div className="pointer-events-none fixed right-4 top-20 z-50 flex max-h-[70vh] w-[min(92vw,300px)] flex-col gap-2 overflow-y-auto">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => onRemove(toast.id), toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onRemove]);

  const bgColor = {
    info: "bg-black/35",
    success: "bg-black/35",
    error: "bg-black/35",
    warning: "bg-black/35",
  }[toast.type];

  const borderColor = {
    info: "border-white/10",
    success: "border-white/10",
    error: "border-white/10",
    warning: "border-white/10",
  }[toast.type];

  return (
    <div
      onClick={() => {
        toast.onClick?.();
        onRemove(toast.id);
      }}
      className={`pointer-events-auto cursor-pointer rounded-lg border border-white/10 px-2 py-2 text-sm text-white shadow-[0_18px_40px_rgba(0,0,0,0.55),0_8px_18px_rgba(0,0,0,0.45)] backdrop-blur-md transition ${borderColor} ${bgColor} hover:bg-black/45`}
      role="alert"
    >
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/10 text-[11px] font-semibold text-white">
          {(toast.avatarLabel?.trim() || toast.title.trim() || "?").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{toast.title}</p>
          {toast.subtitle ? <p className="mt-0.5 line-clamp-2 text-xs text-white/75">{toast.subtitle}</p> : null}
        </div>
        <button
          onClick={(event) => {
            event.stopPropagation();
            onRemove(toast.id);
          }}
          className="rounded-md p-0.5 text-white/75 transition hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          <HiOutlineXMark className="h-4.5 w-4.5" />
        </button>
      </div>
    </div>
  );
}
