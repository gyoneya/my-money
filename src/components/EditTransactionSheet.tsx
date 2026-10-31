import { useEffect, useRef, useState } from 'react'
import {
  listCategories,
  listInstallmentGroup,
  softDeleteTransactions,
  updateInstallmentGroup,
  updateTransaction,
} from '../db/repo'
import type { Category, Transaction } from '../db/types'
import { addMonthsISO, relativeDayLabel, todayISO } from '../lib/dates'
import { splitAmount } from '../lib/installments'
import { formatBRL, pressKey } from '../lib/money'
import { CategoryGrid } from './CategoryGrid'
import { DateSheet } from './DateSheet'
import { Icon } from './Icon'
import { Keypad } from './Keypad'
import { Sheet } from './Sheet'

type Scope = 'one' | 'all'

/** Editar/excluir um lançamento. Parcelas oferecem "só esta" ou "todas". */
export function EditTransactionSheet({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const isGroup = tx.installment_group_id !== null
  const [group, setGroup] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [scope, setScope] = useState<Scope>('one')
  const [cents, setCents] = useState(tx.amount_cents)
  const [date, setDate] = useState(tx.occurred_on)
  const [categoryId, setCategoryId] = useState(tx.category_id)
  const [note, setNote] = useState(tx.note ?? '')
  const [picker, setPicker] = useState<'category' | 'date' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [shake, setShake] = useState(0)
  const touched = useRef(false)

  const today = todayISO()

  useEffect(() => {
    void listCategories(tx.kind).then(setCategories)
    if (tx.installment_group_id) void listInstallmentGroup(tx.installment_group_id).then(setGroup)
  }, [tx])

  // "Todas": valor = total da compra; data = data da compra (1ª parcela).
  function changeScope(s: Scope) {
    setScope(s)
    setConfirmDelete(false)
    touched.current = false
    if (s === 'all') {
      setCents(group.reduce((sum, t) => sum + t.amount_cents, 0))
      // Data da compra = data da parcela mais antiga ativa (a 1ª, se existir). Voltar
      // meses a partir de uma parcela posterior erraria no fim de mês (31/10 → 30/11 → 30/10).
      const first = group[0] ?? tx
      setDate(addMonthsISO(first.occurred_on, -(first.installment_number! - 1)))
    } else {
      setCents(tx.amount_cents)
      setDate(tx.occurred_on)
    }
  }

  const category = categories.find((c) => c.id === categoryId)
  const valid = cents > 0 && (scope === 'one' || splitAmount(cents, group.length) !== null)

  async function save() {
    if (!valid) {
      setShake((n) => n + 1)
      return
    }
    const edit = { amount_cents: cents, category_id: categoryId, occurred_on: date, note }
    if (scope === 'all') await updateInstallmentGroup(tx.installment_group_id!, edit)
    else await updateTransaction(tx.id, edit)
    onClose()
  }

  async function remove() {
    if (!confirmDelete) return setConfirmDelete(true)
    await softDeleteTransactions(scope === 'all' ? group.map((t) => t.id) : [tx.id])
    onClose()
  }

  const color = tx.kind === 'expense' ? 'text-negative' : 'text-positive'
  const chip = 'flex min-w-0 items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-2 text-sm text-text active:bg-line'

  return (
    <>
      <Sheet title={isGroup ? `Parcela ${tx.installment_number}/${tx.installment_total}` : 'Editar lançamento'} onClose={onClose}>
        <div className="flex flex-col gap-3">
          {isGroup && (
            <div className="grid grid-cols-2 rounded-xl bg-bg p-1" role="tablist">
              {(['one', 'all'] as Scope[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={scope === s}
                  onClick={() => changeScope(s)}
                  className={`rounded-lg py-2 text-sm font-semibold ${scope === s ? 'bg-surface-2 text-brand' : 'text-muted'}`}
                >
                  {s === 'one' ? 'Só esta' : `Todas (${group.length})`}
                </button>
              ))}
            </div>
          )}

          <div key={shake} className={`text-center ${shake ? 'shake' : ''}`}>
            <p className="text-xs text-muted">{scope === 'all' ? 'Valor total da compra' : 'Valor'}</p>
            <p className={`text-4xl font-semibold tracking-tight tabular-nums ${cents ? color : 'text-muted'}`}>{formatBRL(cents)}</p>
            {scope === 'all' && group.length > 0 && valid && (
              <p className="text-xs text-muted tabular-nums">
                {group.length}x de {formatBRL(splitAmount(cents, group.length)!.at(-1)!)}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => setPicker('category')} className={`${chip} flex-1`}>
              <span aria-hidden>{category?.icon ?? '•'}</span>
              <span className="truncate">{category?.name ?? 'Categoria'}</span>
            </button>
            <button type="button" onClick={() => setPicker('date')} className={chip}>
              <Icon name="calendar" className="h-4 w-4 shrink-0" />
              {scope === 'all' ? `Compra: ${relativeDayLabel(date, today)}` : relativeDayLabel(date, today)}
            </button>
          </div>

          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="Nota"
            aria-label="Nota"
            className="rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-base text-text outline-none placeholder:text-muted focus:border-brand"
          />

          <Keypad
            onKey={(k) => {
              // Primeira tecla substitui o valor atual em vez de acrescentar dígitos a ele.
              const first = !touched.current
              touched.current = true
              setCents((c) => (!first ? pressKey(c, k) : k === 'back' ? 0 : pressKey(0, k)))
            }}
          />

          {/* Ação principal embaixo à direita */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={remove}
              className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                confirmDelete ? 'bg-negative text-bg' : 'text-negative active:bg-surface-2'
              }`}
            >
              {confirmDelete ? (scope === 'all' ? 'Excluir todas?' : 'Confirmar') : 'Excluir'}
            </button>
            <button
              type="button"
              onClick={save}
              className="flex-1 rounded-xl bg-brand py-3 text-sm font-semibold text-bg active:opacity-80"
            >
              Salvar
            </button>
          </div>
        </div>
      </Sheet>

      {picker === 'category' && (
        <Sheet title="Categoria" onClose={() => setPicker(null)}>
          <CategoryGrid
            categories={categories}
            selectedId={categoryId}
            onPick={(c) => {
              setCategoryId(c.id)
              setPicker(null)
            }}
          />
        </Sheet>
      )}
      {picker === 'date' && (
        <DateSheet
          value={date}
          today={today}
          onPick={(iso) => {
            setDate(iso)
            setPicker(null)
          }}
          onClose={() => setPicker(null)}
        />
      )}
    </>
  )
}
