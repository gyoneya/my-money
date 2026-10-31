import { useState } from 'react'
import type { Category, Kind } from '../db/types'
import { formatBRL, parseBRL } from '../lib/money'
import { Sheet } from './Sheet'

const SUGGESTED: Record<Kind, string[]> = {
  expense: ['☕', '🍔', '⛽', '🚌', '✈️', '🎁', '👕', '💇', '🏋️', '🎮', '🍺', '🧾', '🔧', '👶', '💳', '📱'],
  income: ['💰', '💵', '🎁', '🏦', '🧾', '💻', '🏠', '📦'],
}

export interface CategoryForm {
  name: string
  icon: string | null
  /** Só despesa; null = sem orçamento. */
  monthly_budget_cents: number | null
}

/** Criar (ou editar, com `initial`) categoria: nome, ícone e orçamento opcionais. */
export function NewCategorySheet({
  kind,
  initial,
  onSave,
  onArchive,
  onClose,
}: {
  kind: Kind
  initial?: Category
  onSave: (form: CategoryForm) => void
  onArchive?: () => void
  onClose: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [icon, setIcon] = useState<string | null>(initial?.icon ?? null)
  const [budget, setBudget] = useState(initial?.monthly_budget_cents ? formatBRL(initial.monthly_budget_cents) : '')
  const [confirmArchive, setConfirmArchive] = useState(false)

  const budgetCents = budget.trim() ? parseBRL(budget) : null
  const budgetValid = !budget.trim() || budgetCents !== null
  const valid = name.trim().length > 0 && budgetValid
  // Ícone atual fora das sugestões (ex.: do seed) continua visível para escolha.
  const options = icon && !SUGGESTED[kind].includes(icon) ? [icon, ...SUGGESTED[kind].slice(0, -1)] : SUGGESTED[kind]

  const kindLabel = kind === 'expense' ? 'despesa' : 'receita'
  const title = initial ? 'Editar categoria' : `Nova categoria de ${kindLabel}`
  const input =
    'rounded-xl border border-line bg-surface-2 px-4 py-3 text-base text-text outline-none placeholder:text-muted focus:border-brand'

  return (
    <Sheet title={title} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) onSave({ name: name.trim(), icon, monthly_budget_cents: kind === 'expense' ? budgetCents : null })
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
          className={input}
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
        {kind === 'expense' && (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Orçamento mensal (opcional)</span>
            <input
              inputMode="decimal"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              onBlur={() => budgetCents !== null && setBudget(formatBRL(budgetCents))}
              placeholder="R$ 0,00"
              className={`${input} ${budgetValid ? '' : 'border-warning'}`}
            />
          </label>
        )}
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
            {initial ? 'Salvar' : 'Criar'}
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
