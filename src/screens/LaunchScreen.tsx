import { useCallback, useEffect, useState } from 'react'
import { CategoryGrid } from '../components/CategoryGrid'
import { Keypad } from '../components/Keypad'
import { Toast, type ToastData } from '../components/Toast'
import { addTransactions, buildTransaction, listCategories, softDeleteTransactions } from '../db/repo'
import type { Category, Kind } from '../db/types'
import { todayISO } from '../lib/dates'
import { formatBRL, parseBRL, pressKey } from '../lib/money'

const KIND_LABEL: Record<Kind, string> = { expense: 'Despesa', income: 'Receita' }

export function LaunchScreen() {
  const [kind, setKind] = useState<Kind>('expense')
  const [cents, setCents] = useState(0)
  const [categories, setCategories] = useState<Category[]>([])
  const [shake, setShake] = useState(0)
  const [toast, setToast] = useState<ToastData | null>(null)

  useEffect(() => {
    let alive = true
    listCategories(kind).then((list) => alive && setCategories(list))
    return () => {
      alive = false
    }
  }, [kind])

  const key = useCallback((k: string) => setCents((c) => pressKey(c, k)), [])

  // Teclado físico (desktop).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey) return
      if (/^\d$/.test(e.key)) key(e.key)
      else if (e.key === 'Backspace') key('back')
      else if (e.key === 'Escape') setCents(0)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [key])

  const closeToast = useCallback(() => setToast(null), [])

  async function save(category: Category) {
    if (cents <= 0) {
      setShake((n) => n + 1)
      navigator.vibrate?.([20, 40, 20])
      return
    }
    const tx = buildTransaction({
      kind,
      amount_cents: cents,
      category_id: category.id,
      occurred_on: todayISO(),
    })
    await addTransactions([tx])
    navigator.vibrate?.(30)
    setToast({
      id: Date.now(),
      text: `${formatBRL(cents)} · ${category.name} ✓`,
      onUndo: () => void softDeleteTransactions([tx.id]),
    })
    setCents(0)
  }

  const amountColor = cents === 0 ? 'text-muted' : kind === 'expense' ? 'text-negative' : 'text-positive'

  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col gap-3 px-3 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
      {/* Despesa | Receita */}
      <div className="grid grid-cols-2 rounded-xl bg-surface p-1" role="tablist">
        {(['expense', 'income'] as Kind[]).map((k) => {
          const active = k === kind
          const color = k === 'expense' ? 'text-negative' : 'text-positive'
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setKind(k)}
              className={`rounded-lg py-2 text-sm font-semibold ${active ? `bg-surface-2 ${color}` : 'text-muted'}`}
            >
              {KIND_LABEL[k]}
            </button>
          )
        })}
      </div>

      {/* Valor */}
      <div key={shake} className={`flex flex-col items-center py-2 ${shake ? 'shake' : ''}`}>
        <p className={`text-[2.75rem] leading-none font-semibold tracking-tight tabular-nums ${amountColor}`} aria-hidden>
          {formatBRL(cents)}
        </p>
        <label className="sr-only">
          Valor
          <input
            inputMode="decimal"
            value={cents ? formatBRL(cents) : ''}
            onChange={(e) => setCents(parseBRL(e.target.value) ?? 0)}
          />
        </label>
      </div>

      {/* Categorias */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <CategoryGrid categories={categories} onPick={save} />
      </div>

      <Keypad onKey={key} />

      <Toast toast={toast} onClose={closeToast} />
    </div>
  )
}
