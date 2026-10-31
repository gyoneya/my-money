import { useState } from 'react'
import type { Category, Kind } from '../db/types'
import { Sheet } from './Sheet'

const SUGGESTED: Record<Kind, string[]> = {
  expense: ['☕', '🍔', '⛽', '🚌', '✈️', '🎁', '👕', '💇', '🏋️', '🎮', '🍺', '🧾', '🔧', '👶', '💳', '📱'],
  income: ['💰', '💵', '🎁', '🏦', '🧾', '💻', '🏠', '📦'],
}

/** Criar (ou editar, com `initial`) categoria: nome + ícone opcional. */
export function NewCategorySheet({
  kind,
  initial,
  hasAmount = false,
  onCreate,
  onArchive,
  onClose,
}: {
  kind: Kind
  initial?: Category
  hasAmount?: boolean
  onCreate: (name: string, icon: string | null) => void
  onArchive?: () => void
  onClose: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [icon, setIcon] = useState<string | null>(initial?.icon ?? null)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const valid = name.trim().length > 0
  // Ícone atual fora das sugestões (ex.: do seed) continua visível para escolha.
  const options = icon && !SUGGESTED[kind].includes(icon) ? [icon, ...SUGGESTED[kind].slice(0, -1)] : SUGGESTED[kind]

  const kindLabel = kind === 'expense' ? 'despesa' : 'receita'
  const title = initial ? 'Editar categoria' : `Nova categoria de ${kindLabel}`

  return (
    <Sheet title={title} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) onCreate(name.trim(), icon)
        }}
        className="flex flex-col gap-3"
      >
        <input
          autoFocus={!initial}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          placeholder="Nome"
          enterKeyHint="done"
          className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-base text-text outline-none placeholder:text-muted focus:border-brand"
        />
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs text-muted">Ícone (opcional)</p>
            <input
              value=""
              onChange={(e) => {
                const typed = [...e.target.value.trim()][0]
                if (typed) setIcon(typed)
              }}
              placeholder="outro emoji"
              aria-label="Digitar outro emoji"
              className="w-28 rounded-lg border border-line bg-surface-2 px-2 py-1 text-center text-xs text-text outline-none placeholder:text-muted focus:border-brand"
            />
          </div>
          <div className="grid grid-cols-8 gap-1.5">
            {options.map((e) => (
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
        <div className="flex gap-2">
          {onArchive && (
            <button
              type="button"
              onClick={() => (confirmArchive ? onArchive() : setConfirmArchive(true))}
              className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                confirmArchive ? 'bg-warning text-bg' : 'text-warning active:bg-surface-2'
              }`}
            >
              {confirmArchive ? 'Arquivar?' : 'Arquivar'}
            </button>
          )}
          <button
            type="submit"
            disabled={!valid}
            className="flex-1 rounded-xl bg-brand py-3 text-sm font-semibold text-bg active:opacity-80 disabled:opacity-30"
          >
            {initial ? 'Salvar' : hasAmount ? 'Criar e lançar' : 'Criar'}
          </button>
        </div>
        {onArchive && (
          <p className="-mt-1 text-xs text-muted">
            Arquivar esconde da tela Lançar. Lançamentos antigos continuam no extrato.
          </p>
        )}
      </form>
    </Sheet>
  )
}
