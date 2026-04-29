import { useState } from "react";

export type Toast = {
  id: string;
  title: string;
  subtitle?: string;
  avatarLabel?: string;
  type: "info" | "success" | "error" | "warning";
  duration?: number;
  onClick?: () => void;
};

export type ToastInput = {
  title: string;
  subtitle?: string;
  avatarLabel?: string;
  type?: Toast["type"];
  duration?: number;
  onClick?: () => void;
};

export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (input: ToastInput) => {
    const {
      title,
      subtitle,
      avatarLabel,
      type = "info",
      duration = 5000,
      onClick,
    } = input;
    const id = Math.random().toString(36).substring(7);
    const toast: Toast = { id, title, subtitle, avatarLabel, type, duration, onClick };

    setToasts((prev) => [toast, ...prev]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }

    return id;
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return { toasts, showToast, removeToast };
};
