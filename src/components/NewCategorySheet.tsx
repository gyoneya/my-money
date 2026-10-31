import { useState } from 'react'
import type { Kind } from '../db/types'
import { Sheet } from './Sheet'

const SUGGESTED: Record<Kind, string[]> = {
  expense: ['☕', '🍔', '⛽', '🚌', '✈️', '🎁', '👕', '💇', '🏋️', '🎮', '🍺', '🧾', '🔧', '👶', '💳', '📱'],
  income: ['💰', '💵', '🎁', '🏦', '🧾', '💻', '🏠', '📦'],
}

export function NewCategorySheet({
  kind,
  hasAmount,
  onCreate,
  onClose,
}: {
  kind: Kind
  hasAmount: boolean
  onCreate: (name: string, icon: string | null) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState<string | null>(null)
  const valid = name.trim().length > 0

  return (
    <Sheet title={kind === 'expense' ? 'Nova categoria de despesa' : 'Nova categoria de receita'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) onCreate(name.trim(), icon)
        }}
        className="flex flex-col gap-3"
      >
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          placeholder="Nome"
          enterKeyHint="done"
          className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-base text-text outline-none placeholder:text-muted focus:border-brand"
        />
        <div>
          <p className="mb-2 text-xs text-muted">Ícone (opcional)</p>
          <div className="grid grid-cols-8 gap-1.5">
            {SUGGESTED[kind].map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setIcon(icon === e ? null : e)}
                aria-pressed={icon === e}
                className={`aspect-square rounded-lg text-xl ${icon === e ? 'bg-brand-soft ring-1 ring-brand' : 'bg-surface-2'}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <button
          type="submit"
          disabled={!valid}
          className="rounded-xl bg-brand py-3 text-sm font-semibold text-bg active:opacity-80 disabled:opacity-30"
        >
          {hasAmount ? 'Criar e lançar' : 'Criar'}
        </button>
      </form>
    </Sheet>
  )
}
