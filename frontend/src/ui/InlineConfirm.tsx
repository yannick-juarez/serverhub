import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Button from "./Button";

type InlineConfirmProps = {
  label: ReactNode;
  onConfirm: () => void | Promise<void>;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  variant?: "primary" | "secondary" | "destructive";
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
};

export default function InlineConfirm({
  label,
  onConfirm,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "destructive",
  size = "md",
  disabled = false,
  className = "",
}: InlineConfirmProps) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef(false);

  useEffect(() => {
    if (confirming) {
      cancelRef.current?.focus();
    } else if (restoreFocusRef.current) {
      restoreFocusRef.current = false;
      triggerRef.current?.focus();
    }
  }, [confirming]);

  const cancel = () => {
    if (loading) {
      return;
    }
    restoreFocusRef.current = true;
    setConfirming(false);
  };

  const confirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      restoreFocusRef.current = true;
      setConfirming(false);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  };

  if (!confirming) {
    return (
      <Button ref={triggerRef} variant={variant} size={size} disabled={disabled} className={className} onClick={() => setConfirming(true)}>
        {label}
      </Button>
    );
  }

  const animationClass = "animate-[inline-confirm-in_180ms_ease-out_both] motion-reduce:animate-none";

  return (
    <div role="group" aria-label="Confirm action" className={`inline-flex items-center gap-2 ${className}`} onKeyDown={handleKeyDown}>
      <Button variant={variant} size={size} loading={loading} className={animationClass} onClick={() => void confirm()}>
        {confirmLabel}
      </Button>
      <Button
        ref={cancelRef}
        variant="secondary"
        size={size}
        disabled={loading}
        className={`${animationClass} [animation-delay:50ms]`}
        onClick={cancel}
      >
        {cancelLabel}
      </Button>
    </div>
  );
}
