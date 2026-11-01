import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { EditTransactionSheet } from '../components/EditTransactionSheet'
import { Icon } from '../components/Icon'
import { SyncBadge } from '../components/SyncBadge'
import { onDataChange } from '../db/events'
import { listAllCategories, listTransactionsOfMonth } from '../db/repo'
import type { Category, Transaction } from '../db/types'
import { MonthBar } from '../components/MonthBar'
import { formatDayHeader, monthKey, relativeDayLabel, todayISO } from '../lib/dates'
import { formatBRL } from '../lib/money'
import { groupByDay, signedCents, summarizeMonth } from '../lib/statement'

export interface StatementFilter {
  categoryId: string
  month: string
}

export function StatementScreen({
  filter,
  onClearFilter,
}: {
  filter?: StatementFilter | null
  onClearFilter?: () => void
}) {
  const today = todayISO()
  const [month, setMonth] = useState(filter?.month ?? monthKey(today))
  const [rows, setRows] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Map<string, Category>>(new Map())
  const [editing, setEditing] = useState<Transaction | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const categoryId = filter?.categoryId ?? null

  const load = useCallback(async () => {
    const [txs, cats] = await Promise.all([listTransactionsOfMonth(month), listAllCategories()])
    setRows(categoryId ? txs.filter((t) => t.category_id === categoryId) : txs)
    setCategories(new Map(cats.map((c) => [c.id, c])))
  }, [month, categoryId])

  useEffect(() => {
    void load()
    return onDataChange(() => void load())
  }, [load])

  // Mais recentes embaixo, perto do polegar: abre rolado até o fim.
  useLayoutEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [month, rows.length])

  const summary = summarizeMonth(rows)
  const days = groupByDay(rows)
  const filterCategory = categoryId ? categories.get(categoryId) : undefined

  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col">
      {/* Resumo (só leitura, pode ficar em cima) */}
      <header className="border-b border-line px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
        <div className="flex items-baseline justify-between">
          <p className="text-xs text-muted">{filterCategory ? `Saldo do mês · ${filterCategory.name}` : 'Saldo do mês'}</p>
          <SyncBadge />
        </div>
        <p className={`text-2xl font-semibold tabular-nums ${summary.balance < 0 ? 'text-negative' : 'text-positive'}`}>
          {formatBRL(summary.balance)}
        </p>
        <div className="mt-1 flex gap-4 text-xs tabular-nums">
          <span className="text-positive">+{formatBRL(summary.income)}</span>
          <span className="text-negative">-{formatBRL(summary.expense)}</span>
          {summary.plannedExpense + summary.plannedIncome > 0 && (
            <span className="flex items-center gap-1 text-muted">
              <Icon name="clock" className="h-3 w-3" />
              previsto {formatBRL(summary.plannedIncome - summary.plannedExpense)}
            </span>
          )}
        </div>
      </header>

      {/* Lista */}
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-3">
        {days.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted">Nenhum lançamento neste mês</div>
        ) : (
          <div className="flex min-h-full flex-col justify-end gap-3 py-3">
            {days.map(([day, items]) => (
              <section key={day}>
                <h3 className="mb-1 px-1 text-xs text-muted first-letter:uppercase">
                  {['Hoje', 'Ontem', 'Anteontem'].includes(relativeDayLabel(day, today))
                    ? relativeDayLabel(day, today)
                    : formatDayHeader(day)}
                </h3>
                <ul className="overflow-hidden rounded-xl bg-surface">
                  {items.map((t) => (
                    <TransactionRow key={t.id} tx={t} category={categories.get(t.category_id)} onClick={() => setEditing(t)} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* Filtro vindo da Análise (toque em uma categoria) */}
      {filterCategory && (
        <div className="flex items-center gap-2 border-t border-line px-3 py-2">
          <span className="text-xs text-muted">Só</span>
          <button
            type="button"
            onClick={onClearFilter}
            className="flex min-w-0 items-center gap-1.5 rounded-lg bg-brand-soft px-3 py-1.5 text-sm text-brand"
          >
            <span aria-hidden>{filterCategory.icon ?? '•'}</span>
            <span className="truncate">{filterCategory.name}</span>
            <Icon name="close" className="h-3.5 w-3.5 shrink-0" />
          </button>
        </div>
      )}

      {/* Seletor de mês embaixo (alcance do polegar) */}
      <MonthBar month={month} onChange={setMonth} />

      {editing && <EditTransactionSheet tx={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function TransactionRow({ tx, category, onClick }: { tx: Transaction; category?: Category; onClick: () => void }) {
  const planned = tx.status === 'planned'
  const value = signedCents(tx)
  // A descrição diz o que foi: é o destaque. Sem descrição (lançamentos antigos), a categoria.
  const categoryName = category?.name ?? 'Sem categoria'
  const title = tx.note ?? categoryName
  const detail = [tx.note ? categoryName : null, tx.installment_total ? `${tx.installment_number}/${tx.installment_total}` : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className="border-b border-line last:border-0">
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-surface-2 ${planned ? 'opacity-50' : ''}`}
      >
        <span className="text-xl" aria-hidden>
          {category?.icon ?? '•'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-text">{title}</span>
          {detail && <span className="block truncate text-xs text-muted">{detail}</span>}
        </span>
        {planned && <Icon name="clock" className="h-4 w-4 shrink-0 text-muted" />}
        <span className={`shrink-0 text-sm font-medium tabular-nums ${value < 0 ? 'text-negative' : 'text-positive'}`}>
          {value > 0 ? '+' : ''}
          {formatBRL(value)}
        </span>
      </button>
    </li>
  )
}
