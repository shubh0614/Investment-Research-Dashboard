"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import type { ToastMessage } from "@/lib/toast";

const ICONS = {
  success: CheckCircle2,
  error:   XCircle,
  info:    Info,
};

const COLORS = {
  success: "var(--pos)",
  error:   "var(--neg)",
  info:    "var(--accent)",
};

interface ToastItemProps {
  toast: ToastMessage;
  onRemove: (id: string) => void;
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const [exiting, setExiting] = useState(false);
  const Icon = ICONS[toast.type];
  const color = COLORS[toast.type];

  useEffect(() => {
    const t1 = setTimeout(() => setExiting(true), toast.duration - 250);
    const t2 = setTimeout(() => onRemove(toast.id), toast.duration);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [toast, onRemove]);

  return (
    <div
      className={exiting ? "toast-exit" : "toast-enter"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "12px 14px",
        borderRadius: "10px",
        border: "1px solid var(--border)",
        background: "var(--surface-1)",
        boxShadow: "0 8px 32px rgba(16,18,22,.28)",
        minWidth: "260px",
        maxWidth: "380px",
        pointerEvents: "all",
      }}
    >
      <Icon size={15} strokeWidth={1.5} style={{ color, flexShrink: 0 }} />
      <p style={{ flex: 1, fontSize: "13px", color: "var(--text)", lineHeight: "1.4" }}>
        {toast.message}
      </p>
      <button
        onClick={() => { setExiting(true); setTimeout(() => onRemove(toast.id), 200); }}
        style={{ color: "var(--text-muted)", flexShrink: 0, display: "flex", alignItems: "center" }}
      >
        <X size={13} strokeWidth={1.5} />
      </button>
    </div>
  );
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    function handle(e: Event) {
      const t = (e as CustomEvent).detail as ToastMessage;
      setToasts((prev) => [...prev, t]);
    }
    window.addEventListener("klypup:toast", handle);
    return () => window.removeEventListener("klypup:toast", handle);
  }, []);

  function remove(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  if (!toasts.length) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={remove} />
      ))}
    </div>
  );
}
