import { describe, expect, it } from 'vitest'
import type { Category, Transaction } from '../db/types'
import {
  availableOf,
  budgetLevel,
  byCategory,
  canSpend,
  commitments,
  evolution,
  monthRange,
  monthReport,
  simulatePurchase,
} from './analysis'

const tx = (p: Partial<Transaction>): Transaction => ({
  id: crypto.randomUUID(),
  kind: 'expense',
  status: 'done',
  amount_cents: 100,
  category_id: 'mercado',
  occurred_on: '2026-10-10',
  note: null,
  installment_group_id: null,
  installment_number: null,
  installment_total: null,
  recurring_rule_id: null,
  created_at: '2026-10-10T10:00:00Z',
  updated_at: '2026-10-10T10:00:00Z',
  deleted_at: null,
  pending: 0,
  ...p,
})

const cat = (id: string, p: Partial<Category> = {}): Category => ({
  id,
  kind: 'expense',
  name: id,
  icon: null,
  sort_order: 0,
  monthly_budget_cents: null,
  archived: false,
  updated_at: '2026-10-01T00:00:00Z',
  pending: 0,
  ...p,
})

// Outubro: salário 5.000 (realizado) + extra 500 (previsto); mercado 1.200 realizado;
// aluguel 2.000 previsto; uma despesa excluída; setembro e novembro para checar limites.
const rows = [
  tx({ kind: 'income', category_id: 'salario', amount_cents: 500000, occurred_on: '2026-10-05' }),
  tx({ kind: 'income', category_id: 'extra', amount_cents: 50000, occurred_on: '2026-10-25', status: 'planned' }),
  tx({ category_id: 'mercado', amount_cents: 120000, occurred_on: '2026-10-08' }),
  tx({ category_id: 'moradia', amount_cents: 200000, occurred_on: '2026-10-30', status: 'planned', recurring_rule_id: 'r1' }),
  tx({ category_id: 'mercado', amount_cents: 999999, occurred_on: '2026-10-09', deleted_at: '2026-10-09T12:00:00Z' }),
  tx({ kind: 'income', category_id: 'salario', amount_cents: 400000, occurred_on: '2026-09-05' }),
  tx({ category_id: 'mercado', amount_cents: 100000, occurred_on: '2026-09-12' }),
  tx({ category_id: 'compras', amount_cents: 30000, occurred_on: '2026-11-15', status: 'planned', installment_group_id: 'g1', installment_number: 2, installment_total: 3 }),
]

const categories = [
  cat('mercado', { monthly_budget_cents: 150000 }),
  cat('moradia', { monthly_budget_cents: 200000 }),
  cat('compras'),
  cat('lazer', { monthly_budget_cents: 30000 }),
  cat('antiga', { monthly_budget_cents: 10000, archived: true }),
  cat('salario', { kind: 'income' }),
]

it('monthRange atravessa o ano', () => {
  expect(monthRange('2026-11', 3)).toEqual(['2026-11', '2026-12', '2027-01'])
})

describe('Posso gastar?', () => {
  it('disponível = receitas (realizadas + previstas) − despesas (realizadas + previstas)', () => {
    expect(availableOf(rows, '2026-10')).toBe(500000 + 50000 - 120000 - 200000)
  })

  it('detalha gasto, previsto e orçamento consumido (ignora arquivadas)', () => {
    const s = canSpend(rows, '2026-10', categories)
    expect(s).toEqual({
      available: 230000,
      spent: 120000,
      plannedExpense: 200000,
      income: 550000,
      budgetTotal: 380000,
      budgetUsed: 120000 / 380000,
    })
  })

  it('sem orçamentos: percentual nulo', () => {
    expect(canSpend(rows, '2026-10', [cat('x')]).budgetUsed).toBeNull()
  })
})

describe('Resumo do mês', () => {
  it('mês e saldo acumulado só com realizados', () => {
    expect(monthReport(rows, '2026-09')).toEqual({ income: 400000, expense: 100000, balance: 300000, accumulated: 300000 })
    expect(monthReport(rows, '2026-10')).toEqual({ income: 500000, expense: 120000, balance: 380000, accumulated: 680000 })
  })
})

describe('Por categoria', () => {
  it('cores pelo percentual (com previsto)', () => {
    expect([budgetLevel(null), budgetLevel(0.5), budgetLevel(0.8), budgetLevel(1), budgetLevel(1.01)]).toEqual([
      'none',
      'ok',
      'warn',
      'warn',
      'over',
    ])
  })

  it('lista com gasto ou orçamento, maior gasto primeiro', () => {
    const list = byCategory(rows, '2026-10', categories)
    expect(list.map((u) => [u.category.id, u.spent, u.planned, u.level])).toEqual([
      ['moradia', 0, 200000, 'warn'],
      ['mercado', 120000, 0, 'warn'], // 1.200 de 1.500 = 80% → amarelo
      ['lazer', 0, 0, 'ok'],
    ])
  })
})

describe('Compromissos futuros', () => {
  it('soma previstos por mês e separa parcelas de recorrentes', () => {
    const c = commitments(rows, '2026-10', 3)
    expect(c.map((m) => [m.month, m.installments, m.recurring, m.total])).toEqual([
      ['2026-10', 0, 200000, 200000],
      ['2026-11', 30000, 0, 30000],
      ['2026-12', 0, 0, 0],
    ])
  })
})

describe('Simulador', () => {
  it('antes → depois em cada mês com parcela', () => {
    const sim = simulatePurchase(rows, { totalCents: 100000, installments: 3, date: '2026-10-31' })!
    expect(sim).toEqual([
      { month: '2026-10', installment: 33334, before: 230000, after: 196666 },
      { month: '2026-11', installment: 33333, before: -30000, after: -63333 },
      { month: '2026-12', installment: 33333, before: 0, after: -33333 },
    ])
  })

  it('à vista = valor cheio no mês', () => {
    expect(simulatePurchase(rows, { totalCents: 5000, installments: 1, date: '2026-10-31' })).toEqual([
      { month: '2026-10', installment: 5000, before: 230000, after: 225000 },
    ])
  })

  it('inválido quando o valor não cobre as parcelas', () => {
    expect(simulatePurchase(rows, { totalCents: 2, installments: 3, date: '2026-10-31' })).toBeNull()
  })
})

describe('Evolução', () => {
  it('12 meses terminando no mês, só realizados', () => {
    const e = evolution(rows, '2026-10', 12)
    expect(e).toHaveLength(12)
    expect(e[0].month).toBe('2025-11')
    expect(e.at(-2)).toEqual({ month: '2026-09', income: 400000, expense: 100000 })
    expect(e.at(-1)).toEqual({ month: '2026-10', income: 500000, expense: 120000 })
  })
})
