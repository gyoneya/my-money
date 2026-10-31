import type { Transaction } from '../db/types'

export interface MonthSummary {
  income: number
  expense: number
  /** Receitas − despesas realizadas no mês. */
  balance: number
  /** Ainda previstas no mês (despesas e receitas). */
  plannedExpense: number
  plannedIncome: number
}

export function summarizeMonth(rows: Transaction[]): MonthSummary {
  const s: MonthSummary = { income: 0, expense: 0, balance: 0, plannedExpense: 0, plannedIncome: 0 }
  for (const t of rows) {
    if (t.deleted_at) continue
    if (t.status === 'done') {
      if (t.kind === 'income') s.income += t.amount_cents
      else s.expense += t.amount_cents
    } else if (t.kind === 'income') s.plannedIncome += t.amount_cents
    else s.plannedExpense += t.amount_cents
  }
  s.balance = s.income - s.expense
  return s
}

/** Agrupa por dia, em ordem crescente (o mais recente fica embaixo, perto do polegar). */
export function groupByDay(rows: Transaction[]): [day: string, items: Transaction[]][] {
  const map = new Map<string, Transaction[]>()
  const sorted = [...rows].sort(
    (a, b) => a.occurred_on.localeCompare(b.occurred_on) || a.created_at.localeCompare(b.created_at),
  )
  for (const t of sorted) {
    const list = map.get(t.occurred_on)
    if (list) list.push(t)
    else map.set(t.occurred_on, [t])
  }
  return [...map.entries()]
}

/** Valor com sinal: despesa negativa, receita positiva. */
export function signedCents(t: Pick<Transaction, 'kind' | 'amount_cents'>): number {
  return t.kind === 'expense' ? -t.amount_cents : t.amount_cents
}
