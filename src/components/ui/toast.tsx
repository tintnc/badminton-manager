/* eslint-disable react-refresh/only-export-components */
import { useSyncExternalStore } from "react"
import { create } from "zustand"
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react"
import { cn } from "@/lib/utils"

type ToastTone = "success" | "error" | "info"

interface Toast {
  id: number
  tone: ToastTone
  message: string
}

interface ToastState {
  toasts: Toast[]
}

export const useToastStore = create<ToastState>(() => ({ toasts: [] }))

export function toast(message: string, tone: ToastTone = "success") {
  const id = Date.now() + Math.random()
  useToastStore.setState((state) => ({ toasts: [...state.toasts, { id, tone, message }] }))
  const duration = tone === "error" ? 6000 : 4000
  setTimeout(() => removeToast(id), duration)
}

function removeToast(id: number) {
  useToastStore.setState((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
}

const toneStyles: Record<ToastTone, { icon: typeof Info; wrap: string }> = {
  success: { icon: CheckCircle2, wrap: "text-success" },
  error: { icon: AlertCircle, wrap: "text-destructive" },
  info: { icon: Info, wrap: "text-info" },
}

export function Toaster() {
  const toasts = useSyncExternalStore(
    (onStoreChange) => useToastStore.subscribe(onStoreChange),
    () => useToastStore.getState().toasts,
    () => []
  )

  if (toasts.length === 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col items-stretch gap-2 px-4 sm:left-auto sm:right-4 sm:translate-x-0 sm:px-0"
    >
      {toasts.map((t) => {
        const Icon = toneStyles[t.tone].icon
        return (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-sm shadow-lg animate-in slide-in-from-bottom-2 fade-in-0",
              toneStyles[t.tone].wrap
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 text-foreground">{t.message}</span>
            <button
              type="button"
              aria-label="Đóng thông báo"
              onClick={() => removeToast(t.id)}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
