export type ToastType = "success" | "error" | "info";

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

export function toast(message: string, type: ToastType = "info", duration = 3500) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("klypup:toast", {
      detail: { id: crypto.randomUUID(), message, type, duration } satisfies ToastMessage,
    })
  );
}
