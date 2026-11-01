import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { MonthBar } from '../components/MonthBar'
import { onDataChange } from '../db/events'
import { listAllCategories, listAllTransactions } from '../db/repo'
import type { Category, Transaction } from '../db/types'
import { budgetLevel, byCategory, canSpend, monthReport, type BudgetLevel } from '../lib/analysis'
import { formatMonthLabel, monthKey, todayISO } from '../lib/dates'
import { formatBRL } from '../lib/money'
import { CommitmentsChart, EvolutionChart } from './AnalysisCharts'
import { SimulatorCard } from './SimulatorCard'

const LEVEL_TEXT: Record<BudgetLevel, string> = {
  ok: 'text-positive',
  warn: 'text-warning',
  over: 'text-negative',
  none: 'text-muted',
}
const LEVEL_BAR: Record<BudgetLevel, string> = {
  ok: 'bg-positive',
  warn: 'bg-warning',
  over: 'bg-negative',
  none: 'bg-brand',
}

const pct = (r: number) => `${Math.round(r * 100)}%`

export function AnalysisScreen({ onOpenCategory }: { onOpenCategory: (categoryId: string, month: string) => void }) {
  const [month, setMonth] = useState(monthKey(todayISO()))
  const [rows, setRows] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  const load = useCallback(async () => {
    const [t, c] = await Promise.all([listAllTransactions(), listAllCategories()])
    setRows(t)
    setCategories(c)
  }, [])

  useEffect(() => {
    void load()
    return onDataChange(() => void load())
  }, [load])

  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col md:max-w-5xl">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <CanSpendCard rows={rows} categories={categories} month={month} />
          <SummaryCard rows={rows} month={month} />
          <CategoriesCard rows={rows} categories={categories} month={month} onOpen={(id) => onOpenCategory(id, month)} />
          <Card title="Compromissos futuros">
            <CommitmentsChart rows={rows} fromMonth={month} />
          </Card>
          <SimulatorCard rows={rows} />
          <Card title="Evolução (12 meses)">
            <EvolutionChart rows={rows} endMonth={month} />
          </Card>
        </div>
      </div>
      <MonthBar month={month} onChange={setMonth} />
    </div>
  )
}

function Card({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-surface p-4 ${className}`}>
      <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">{title}</h2>
      {children}
    </section>
  )
}

function Line({ label, value, className = 'text-text' }: { label: string; value: number; className?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className={`tabular-nums ${className}`}>{formatBRL(value)}</span>
    </div>
  )
}

// 1. Posso gastar?
function CanSpendCard({ rows, categories, month }: { rows: Transaction[]; categories: Category[]; month: string }) {
  const s = canSpend(rows, month, categories)
  const level = s.budgetUsed === null ? 'none' : budgetLevel(s.budgetUsed)
  return (
    <Card title="Posso gastar?" className="ring-1 ring-brand/30">
      <p className={`text-4xl font-semibold tracking-tight tabular-nums ${s.available < 0 ? 'text-negative' : 'text-positive'}`}>
        {formatBRL(s.available)}
      </p>
      <p className="mt-1 mb-4 text-xs text-muted first-letter:uppercase">
        {s.available < 0 ? 'Faltando' : 'Disponível'} em {formatMonthLabel(month)}
      </p>
      <div className="flex flex-col gap-1.5">
        <Line label="Receitas do mês" value={s.income} className="text-positive" />
        <Line label="Gasto até hoje" value={-s.spent} className="text-negative" />
        <Line label="Previsto até o fim do mês" value={-s.plannedExpense} className="text-negative" />
      </div>
      {s.budgetTotal !== null && (
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-muted">Orçamento total ({formatBRL(s.budgetTotal)})</span>
            <span className={`tabular-nums ${LEVEL_TEXT[level]}`}>{pct(s.budgetUsed!)}</span>
          </div>
          <Bar ratio={s.budgetUsed!} level={level} />
        </div>
      )}
    </Card>
  )
}

// 2. Resumo do mês
function SummaryCard({ rows, month }: { rows: Transaction[]; month: string }) {
  const r = monthReport(rows, month)
  const cell = (label: string, value: number, color: string) => (
    <div className="rounded-xl bg-surface-2 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-0.5 text-base font-semibold tabular-nums ${color}`}>{formatBRL(value)}</p>
    </div>
  )
  const sign = (v: number) => (v < 0 ? 'text-negative' : 'text-positive')
  return (
    <Card title="Resumo do mês">
      <div className="grid grid-cols-2 gap-2">
        {cell('Receitas', r.income, 'text-positive')}
        {cell('Despesas', -r.expense, 'text-negative')}
        {cell('Saldo do mês', r.balance, sign(r.balance))}
        {cell('Saldo acumulado', r.accumulated, sign(r.accumulated))}
      </div>
      <p className="mt-2 text-xs text-muted">Só lançamentos realizados.</p>
    </Card>
  )
}

// 3. Por categoria
function CategoriesCard({
  rows,
  categories,
  month,
  onOpen,
}: {
  rows: Transaction[]
  categories: Category[]
  month: string
  onOpen: (categoryId: string) => void
}) {
  const list = byCategory(rows, month, categories)
  const maxTotal = Math.max(1, ...list.map((u) => u.spent + u.planned))
  return (
    <Card title="Por categoria" className="md:row-span-2">
      {list.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma despesa neste mês.</p>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {list.map((u) => {
            const total = u.spent + u.planned
            // Com orçamento: barra relativa ao orçamento. Sem: relativa à maior categoria.
            const base = u.budget ?? maxTotal
            return (
              <li key={u.category.id}>
                <button
                  type="button"
                  onClick={() => onOpen(u.category.id)}
                  className="flex w-full flex-col gap-1.5 rounded-xl px-2 py-2 text-left active:bg-surface-2"
                >
                  <span className="flex items-center gap-2 text-sm">
                    <span aria-hidden>{u.category.icon ?? '•'}</span>
                    <span className="min-w-0 flex-1 truncate text-text">{u.category.name}</span>
                    <span className="tabular-nums text-text">{formatBRL(total)}</span>
                    {u.budget && (
                      <span className={`w-10 text-right text-xs tabular-nums ${LEVEL_TEXT[u.level]}`}>{pct(u.ratio!)}</span>
                    )}
                  </span>
                  <Bar ratio={u.spent / base} plannedRatio={u.planned / base} level={u.level} />
                  {(u.budget || u.planned > 0) && (
                    <span className="text-xs text-muted tabular-nums">
                      {u.planned > 0 && `${formatBRL(u.planned)} previsto`}
                      {u.planned > 0 && u.budget ? ' · ' : ''}
                      {u.budget && `orçamento ${formatBRL(u.budget)}`}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

/** Barra de progresso: parte realizada cheia, prevista esmaecida. Passou de 100% fica cheia. */
function Bar({ ratio, plannedRatio = 0, level }: { ratio: number; plannedRatio?: number; level: BudgetLevel }) {
  const done = Math.min(ratio, 1)
  const planned = Math.min(plannedRatio, 1 - done)
  return (
    <span className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
      <span className={`h-full ${LEVEL_BAR[level]}`} style={{ width: `${done * 100}%` }} />
      <span className={`h-full opacity-40 ${LEVEL_BAR[level]}`} style={{ width: `${planned * 100}%` }} />
    </span>
  )
}
