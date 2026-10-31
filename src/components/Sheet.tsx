import { useEffect, type ReactNode } from 'react'
import { Icon } from './Icon'

/** Painel que sobe da parte de baixo da tela. */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="sheet-backdrop absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="sheet-in relative w-full max-w-md rounded-t-2xl border-t border-line bg-surface px-4 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="-mr-2 rounded-lg p-2 text-muted active:bg-surface-2">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
