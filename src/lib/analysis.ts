// Cálculos da aba Análise, feitos no cliente sobre os dados locais (funcionam offline).
// Todas as funções são puras: recebem os lançamentos e devolvem números em centavos.
import type { Category, Transaction } from '../db/types'
import { addMonthsISO, monthKey } from './dates'
import { installmentDates, splitAmount } from './installments'

/** `n` meses a partir de `start` (AAAA-MM), inclusive. */
export function monthRange(start: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => monthKey(addMonthsISO(`${start}-01`, i)))
}

const active = (rows: Transaction[]) => rows.filter((t) => !t.deleted_at)
const inMonth = (t: Transaction, month: string) => t.occurred_on.startsWith(month)

interface Totals {
  incomeDone: number
  incomePlanned: number
  expenseDone: number
  expensePlanned: number
}

function totalsOf(rows: Transaction[], month: string): Totals {
  const s: Totals = { incomeDone: 0, incomePlanned: 0, expenseDone: 0, expensePlanned: 0 }
  for (const t of rows) {
    if (t.deleted_at || !inMonth(t, month)) continue
    const done = t.status === 'done'
    if (t.kind === 'income') done ? (s.incomeDone += t.amount_cents) : (s.incomePlanned += t.amount_cents)
    else done ? (s.expenseDone += t.amount_cents) : (s.expensePlanned += t.amount_cents)
  }
  return s
}

/** Disponível no mês = receitas (realizadas + previstas) − despesas realizadas − despesas previstas. */
export function availableOf(rows: Transaction[], month: string): number {
  const s = totalsOf(rows, month)
  return s.incomeDone + s.incomePlanned - s.expenseDone - s.expensePlanned
}

// ---------------------------------------------------------------------------
// 1. Posso gastar?
// ---------------------------------------------------------------------------

export interface CanSpend {
  available: number
  /** Despesas já realizadas no mês. */
  spent: number
  /** Despesas previstas até o fim do mês (parcelas, recorrentes). */
  plannedExpense: number
  income: number
  /** Soma dos orçamentos das categorias de despesa ativas (null se nenhuma tiver orçamento). */
  budgetTotal: number | null
  /** spent / budgetTotal (0..n). */
  budgetUsed: number | null
}

export function canSpend(rows: Transaction[], month: string, categories: Category[]): CanSpend {
  const s = totalsOf(rows, month)
  const budgets = categories.filter((c) => c.kind === 'expense' && !c.archived && c.monthly_budget_cents)
  const budgetTotal = budgets.length ? budgets.reduce((sum, c) => sum + c.monthly_budget_cents!, 0) : null
  return {
    available: s.incomeDone + s.incomePlanned - s.expenseDone - s.expensePlanned,
    spent: s.expenseDone,
    plannedExpense: s.expensePlanned,
    income: s.incomeDone + s.incomePlanned,
    budgetTotal,
    budgetUsed: budgetTotal ? s.expenseDone / budgetTotal : null,
  }
}

// ---------------------------------------------------------------------------
// 2. Resumo do mês
// ---------------------------------------------------------------------------

export interface MonthReport {
  income: number
  expense: number
  balance: number
  /** Saldo acumulado (realizados) desde o primeiro lançamento até o fim do mês. Saldo inicial = 0. */
  accumulated: number
}

export function monthReport(rows: Transaction[], month: string): MonthReport {
  const s = totalsOf(rows, month)
  const end = `${month}-31`
  let accumulated = 0
  for (const t of active(rows)) {
    if (t.status !== 'done' || t.occurred_on > end) continue
    accumulated += t.kind === 'income' ? t.amount_cents : -t.amount_cents
  }
  return { income: s.incomeDone, expense: s.expenseDone, balance: s.incomeDone - s.expenseDone, accumulated }
}

// ---------------------------------------------------------------------------
// 3. Por categoria
// ---------------------------------------------------------------------------

export type BudgetLevel = 'ok' | 'warn' | 'over' | 'none'

export interface CategoryUsage {
  category: Category
  spent: number
  planned: number
  budget: number | null
  /** (realizado + previsto) / orçamento. */
  ratio: number | null
  /** verde < 80%, amarelo 80–100%, vermelho > 100% (considerando o previsto). */
  level: BudgetLevel
}

export function budgetLevel(ratio: number | null): BudgetLevel {
  if (ratio === null) return 'none'
  if (ratio > 1) return 'over'
  if (ratio >= 0.8) return 'warn'
  return 'ok'
}

/** Categorias de despesa com gasto ou orçamento no mês, da maior para a menor. */
export function byCategory(rows: Transaction[], month: string, categories: Category[]): CategoryUsage[] {
  const spent = new Map<string, number>()
  const planned = new Map<string, number>()
  for (const t of rows) {
    if (t.deleted_at || t.kind !== 'expense' || !inMonth(t, month)) continue
    const map = t.status === 'done' ? spent : planned
    map.set(t.category_id, (map.get(t.category_id) ?? 0) + t.amount_cents)
  }
  return categories
    .filter((c) => c.kind === 'expense')
    .map((c) => {
      const s = spent.get(c.id) ?? 0
      const p = planned.get(c.id) ?? 0
      const budget = c.monthly_budget_cents || null
      const ratio = budget ? (s + p) / budget : null
      return { category: c, spent: s, planned: p, budget, ratio, level: budgetLevel(ratio) }
    })
    .filter((u) => u.spent > 0 || u.planned > 0 || (u.budget && !u.category.archived))
    .sort((a, b) => b.spent + b.planned - (a.spent + a.planned) || a.category.sort_order - b.category.sort_order)
}

// ---------------------------------------------------------------------------
// 4. Compromissos futuros
// ---------------------------------------------------------------------------

export interface Commitment {
  month: string
  installments: number
  recurring: number
  other: number
  total: number
}

/** Despesas previstas por mês (parcelas + recorrentes + outras futuras). */
export function commitments(rows: Transaction[], fromMonth: string, n = 12): Commitment[] {
  const months = monthRange(fromMonth, n)
  const map = new Map(months.map((m) => [m, { month: m, installments: 0, recurring: 0, other: 0, total: 0 }]))
  for (const t of rows) {
    if (t.deleted_at || t.kind !== 'expense' || t.status !== 'planned') continue
    const c = map.get(monthKey(t.occurred_on))
    if (!c) continue
    if (t.installment_group_id) c.installments += t.amount_cents
    else if (t.recurring_rule_id) c.recurring += t.amount_cents
    else c.other += t.amount_cents
    c.total += t.amount_cents
  }
  return months.map((m) => map.get(m)!)
}

// ---------------------------------------------------------------------------
// 5. Simulador de compra
// ---------------------------------------------------------------------------

export interface SimMonth {
  month: string
  installment: number
  before: number
  after: number
}

/** Efeito de uma compra (sem salvar) no "Disponível" de cada mês com parcela. */
export function simulatePurchase(
  rows: Transaction[],
  purchase: { totalCents: number; installments: number; date: string },
): SimMonth[] | null {
  const amounts = splitAmount(purchase.totalCents, purchase.installments)
  if (!amounts) return null
  const dates = installmentDates(purchase.date, purchase.installments)
  return amounts.map((amount, i) => {
    const month = monthKey(dates[i])
    const before = availableOf(rows, month)
    return { month, installment: amount, before, after: before - amount }
  })
}

// ---------------------------------------------------------------------------
// 6. Evolução
// ---------------------------------------------------------------------------

export interface EvolutionPoint {
  month: string
  income: number
  expense: number
}

/** Receitas vs. despesas realizadas nos `n` meses terminando em `endMonth`. */
export function evolution(rows: Transaction[], endMonth: string, n = 12): EvolutionPoint[] {
  const months = monthRange(monthKey(addMonthsISO(`${endMonth}-01`, -(n - 1))), n)
  const map = new Map(months.map((m) => [m, { month: m, income: 0, expense: 0 }]))
  for (const t of rows) {
    if (t.deleted_at || t.status !== 'done') continue
    const p = map.get(monthKey(t.occurred_on))
    if (!p) continue
    if (t.kind === 'income') p.income += t.amount_cents
    else p.expense += t.amount_cents
  }
  return months.map((m) => map.get(m)!)
}
