import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { CategoryGrid } from '../components/CategoryGrid'
import { DateSheet } from '../components/DateSheet'
import { Icon, type IconName } from '../components/Icon'
import { Keypad } from '../components/Keypad'
import { NewCategorySheet } from '../components/NewCategorySheet'
import { NoteSheet } from '../components/NoteSheet'
import { Toast, type ToastData } from '../components/Toast'
import { addTransactions, buildTransaction, createCategory, listCategories, softDeleteTransactions } from '../db/repo'
import type { Category, Kind } from '../db/types'
import { relativeDayLabel, todayISO } from '../lib/dates'
import { formatBRL, parseBRL, pressKey } from '../lib/money'

const KIND_LABEL: Record<Kind, string> = { expense: 'Despesa', income: 'Receita' }

type SheetId = 'date' | 'note' | 'category'

export function LaunchScreen() {
  const [kind, setKind] = useState<Kind>('expense')
  const [cents, setCents] = useState(0)
  const [date, setDate] = useState<string | null>(null) // null = hoje
  const [note, setNote] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [sheet, setSheet] = useState<SheetId | null>(null)
  const [shake, setShake] = useState(0)
  const [toast, setToast] = useState<ToastData | null>(null)

  const today = todayISO()
  const occurredOn = date ?? today

  const reloadCategories = useCallback(async (k: Kind) => {
    setCategories(await listCategories(k))
  }, [])

  useEffect(() => {
    void reloadCategories(kind)
  }, [kind, reloadCategories])

  const key = useCallback((k: string) => setCents((c) => pressKey(c, k)), [])

  // Teclado físico (desktop).
  useEffect(() => {
    if (sheet) return
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
  }, [key, sheet])

  const closeToast = useCallback(() => setToast(null), [])
  const closeSheet = useCallback(() => setSheet(null), [])

  function reset() {
    setCents(0)
    setDate(null)
    setNote('')
  }

  function rejectEmpty() {
    setShake((n) => n + 1)
    navigator.vibrate?.([20, 40, 20])
  }

  async function save(category: Category) {
    if (cents <= 0) return rejectEmpty()
    const tx = buildTransaction({ kind, amount_cents: cents, category_id: category.id, occurred_on: occurredOn, note })
    await addTransactions([tx])
    navigator.vibrate?.(30)
    const when = occurredOn === today ? '' : ` · ${relativeDayLabel(occurredOn, today)}`
    setToast({
      id: Date.now(),
      text: `${formatBRL(cents)} · ${category.name}${when} ✓`,
      onUndo: () => void softDeleteTransactions([tx.id]),
    })
    reset()
  }

  async function createAndSave(name: string, icon: string | null) {
    const category = await createCategory({ kind, name, icon })
    setSheet(null)
    await reloadCategories(kind)
    if (cents > 0) await save(category)
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
        <CategoryGrid categories={categories} onPick={save} onAdd={() => setSheet('category')} />
      </div>

      {/* Opcionais */}
      <div className="flex gap-2">
        <Chip icon="calendar" active={date !== null} onClick={() => setSheet('date')}>
          {relativeDayLabel(occurredOn, today)}
        </Chip>
        <Chip icon="note" active={note !== ''} onClick={() => setSheet('note')} grow>
          {note || 'Nota'}
        </Chip>
      </div>

      <Keypad onKey={key} />

      {sheet === 'date' && (
        <DateSheet
          value={occurredOn}
          today={today}
          onPick={(iso) => {
            setDate(iso === today ? null : iso)
            setSheet(null)
          }}
          onClose={closeSheet}
        />
      )}
      {sheet === 'note' && (
        <NoteSheet
          value={note}
          onSave={(n) => {
            setNote(n)
            setSheet(null)
          }}
          onClose={closeSheet}
        />
      )}
      {sheet === 'category' && (
        <NewCategorySheet kind={kind} hasAmount={cents > 0} onCreate={createAndSave} onClose={closeSheet} />
      )}

      <Toast toast={toast} onClose={closeToast} />
    </div>
  )
}

function Chip({
  icon,
  active,
  grow,
  onClick,
  children,
}: {
  icon: IconName
  active: boolean
  grow?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${grow ? 'flex-1' : ''} ${
        active ? 'bg-brand-soft text-brand' : 'text-muted active:bg-surface'
      }`}
    >
      <Icon name={icon} className="h-4 w-4 shrink-0" />
      <span className="truncate">{children}</span>
    </button>
  )
}
