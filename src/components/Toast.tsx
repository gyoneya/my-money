import { useEffect } from 'react'

export interface ToastData {
  id: number
  text: string
  onUndo?: () => void
}

const DURATION_MS = 5000

export function Toast({ toast, onClose }: { toast: ToastData | null; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onClose, DURATION_MS)
    return () => clearTimeout(t)
  }, [toast, onClose])

  if (!toast) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[max(env(safe-area-inset-top),0.75rem)]">
      <div
        role="status"
        className="toast-in pointer-events-auto flex max-w-md flex-1 items-center gap-3 rounded-2xl border border-line bg-surface-2 py-2.5 pr-2 pl-4 shadow-lg"
      >
        <span className="flex-1 truncate text-sm text-text">{toast.text}</span>
        {toast.onUndo && (
          <button
            type="button"
            onClick={() => {
              toast.onUndo!()
              onClose()
            }}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-brand active:bg-brand-soft"
          >
            Desfazer
          </button>
        )}
      </div>
    </div>
  )
}
