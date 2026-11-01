import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { CategoryGrid } from '../components/CategoryGrid'
import { DateSheet } from '../components/DateSheet'
import { Icon, type IconName } from '../components/Icon'
import { Keypad } from '../components/Keypad'
import { Toast, type ToastData } from '../components/Toast'
import { InstallmentsSheet } from '../components/InstallmentsSheet'
import {
  addTransactions,
  buildInstallmentTransactions,
  listCategories,
  softDeleteTransactions,
} from '../db/repo'
import { onDataChange } from '../db/events'
import type { Category, Kind } from '../db/types'
import { relativeDayLabel, todayISO } from '../lib/dates'
import { splitAmount } from '../lib/installments'
import { formatBRL, parseBRL, pressKey } from '../lib/money'

const KIND_LABEL: Record<Kind, string> = { expense: 'Despesa', income: 'Receita' }

type SheetId = 'date' | 'installments'

export function LaunchScreen() {
  const [kind, setKind] = useState<Kind>('expense')
  const [cents, setCents] = useState(0)
  const [date, setDate] = useState<string | null>(null) // null = hoje
  const [note, setNote] = useState('')
  const [installments, setInstallments] = useState(1)
  const [categories, setCategories] = useState<Category[]>([])
  const [sheet, setSheet] = useState<SheetId | null>(null)
  const [shake, setShake] = useState(0)
  const [toast, setToast] = useState<ToastData | null>(null)
  const [pendingCategory, setPendingCategory] = useState<Category | null>(null)
  const noteRef = useRef<HTMLInputElement>(null)
  const noteBoxRef = useRef<HTMLDivElement>(null)

  const today = todayISO()
  const occurredOn = date ?? today

  const reloadCategories = useCallback(async (k: Kind) => {
    setCategories(await listCategories(k))
  }, [])

  useEffect(() => {
    void reloadCategories(kind)
    // Categorias criadas/editadas em outro aparelho chegam pelo sync.
    return onDataChange((source) => source === 'remote' && void reloadCategories(kind))
  }, [kind, reloadCategories])

  // Com mais categorias do que cabem, a grade rola — mas sempre começa (e se mantém,
  // quando a altura muda, ex.: teclado do sistema abrindo) encostada embaixo, onde
  // estão as principais. As de cima (menos usadas) ficam a um arrasto de distância.
  const gridScrollRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = gridScrollRef.current
    if (!el) return
    const toBottom = () => {
      el.scrollTop = el.scrollHeight
    }
    toBottom()
    const observer = new ResizeObserver(toBottom)
    observer.observe(el)
    return () => observer.disconnect()
  }, [categories])

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
    setInstallments(1)
    setPendingCategory(null)
  }

  function changeKind(k: Kind) {
    setKind(k)
    setPendingCategory(null)
    if (k === 'income') setInstallments(1) // parcelas só para despesa
  }

  function rejectEmpty() {
    setShake((n) => n + 1)
    navigator.vibrate?.([20, 40, 20])
  }

  async function save(category: Category) {
    if (cents <= 0 || (installments > 1 && !splitAmount(cents, installments))) return rejectEmpty()
    // Descrição obrigatória: guarda a categoria tocada e pede a descrição; o "OK" do
    // teclado do sistema conclui o lançamento sem precisar tocar na categoria de novo.
    if (!note.trim()) {
      setPendingCategory(category)
      navigator.vibrate?.([20, 40, 20])
      // Treme sem recriar o campo (recriar tiraria o foco/teclado).
      const box = noteBoxRef.current
      if (box) {
        box.classList.remove('shake')
        void box.offsetWidth
        box.classList.add('shake')
      }
      noteRef.current?.focus()
      return
    }
    setPendingCategory(null)
    const rows = buildInstallmentTransactions(
      { kind, amount_cents: cents, category_id: category.id, occurred_on: occurredOn, note },
      installments,
      today,
    )
    await addTransactions(rows)
    navigator.vibrate?.(30)
    const when = occurredOn === today ? '' : ` · ${relativeDayLabel(occurredOn, today)}`
    const times = installments > 1 ? ` · ${installments}x` : ''
    setToast({
      id: Date.now(),
      text: `${formatBRL(cents)} · ${note.trim()} · ${category.name}${times}${when} ✓`,
      onUndo: () => void softDeleteTransactions(rows.map((r) => r.id)),
    })
    reset()
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
              onClick={() => changeKind(k)}
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
        {installments > 1 && (
          <p className="mt-1.5 text-sm text-muted tabular-nums">
            {installments}x de {formatBRL(splitAmount(cents, installments)?.at(-1) ?? 0)}
          </p>
        )}
        <label className="sr-only">
          Valor
          <input
            inputMode="decimal"
            value={cents ? formatBRL(cents) : ''}
            onChange={(e) => setCents(parseBRL(e.target.value) ?? 0)}
          />
        </label>
      </div>

      {/* Opcionais, perto do valor */}
      <div className="flex justify-center gap-1.5">
        <Chip icon="calendar" active={date !== null} onClick={() => setSheet('date')}>
          {relativeDayLabel(occurredOn, today)}
        </Chip>
        {kind === 'expense' && (
          <Chip icon="layers" active={installments > 1} onClick={() => setSheet('installments')}>
            {installments}x
          </Chip>
        )}
      </div>

      {/* Categorias: alinhadas embaixo, ao alcance do polegar. Aviso logo acima delas. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div ref={gridScrollRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="mt-auto">
            <CategoryGrid categories={categories} onPick={save} />
          </div>
        </div>
        <Toast toast={toast} onClose={closeToast} />
      </div>

      {/* Teclado em painel próprio, visualmente separado das categorias */}
      <div className="-mx-3 -mb-3 flex flex-col gap-1.5 rounded-t-2xl bg-surface-2 px-3 pt-3 pb-3">
        {/* Descrição (obrigatória) sempre à vista: tocar abre o teclado do sistema */}
        <div ref={noteBoxRef} className="relative">
          <input
            ref={noteRef}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              e.currentTarget.blur()
              if (pendingCategory && note.trim()) void save(pendingCategory)
            }}
            maxLength={200}
            placeholder={pendingCategory ? `Descrição para ${pendingCategory.name}` : 'Descrição'}
            aria-label="Descrição"
            aria-required="true"
            enterKeyHint={pendingCategory ? 'send' : 'done'}
            autoCapitalize="sentences"
            className={`h-12 w-full rounded-xl bg-key px-4 pr-11 text-base text-text outline-none placeholder:text-muted focus:ring-1 ${
              pendingCategory && !note.trim() ? 'ring-1 ring-warning placeholder:text-warning focus:ring-warning' : 'focus:ring-brand'
            }`}
          />
          {note && (
            <button
              type="button"
              onClick={() => setNote('')}
              aria-label="Limpar descrição"
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          )}
        </div>
        <Keypad onKey={key} />
      </div>

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
      {sheet === 'installments' && (
        <InstallmentsSheet
          value={installments}
          totalCents={cents}
          onPick={(n) => {
            setInstallments(n)
            setSheet(null)
          }}
          onClose={closeSheet}
        />
      )}
    </div>
  )
}

function Chip({
  icon,
  active,
  onClick,
  children,
}: {
  icon: IconName
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex max-w-[45%] min-w-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${
        active ? 'bg-brand-soft text-brand' : 'text-muted active:bg-surface'
      }`}
    >
      <Icon name={icon} className="h-4 w-4 shrink-0" />
      <span className="truncate">{children}</span>
    </button>
  )
}
