import { describe, expect, it } from 'vitest'
import type { Transaction } from '../db/types'
import { groupByDay, signedCents, summarizeMonth } from './statement'

const t = (p: Partial<Transaction>): Transaction => ({
  id: crypto.randomUUID(),
  kind: 'expense',
  status: 'done',
  amount_cents: 100,
  category_id: 'c',
  occurred_on: '2026-10-10',
  note: null,
  installment_group_id: null,
  installment_number: null,
  installment_total: null,
  recurring_rule_id: null,
  created_at: '2026-10-10T10:00:00.000Z',
  updated_at: '2026-10-10T10:00:00.000Z',
  deleted_at: null,
  pending: 0,
  ...p,
})

describe('summarizeMonth', () => {
  it('separa realizado e previsto, ignora excluídos', () => {
    const s = summarizeMonth([
      t({ kind: 'income', amount_cents: 500000 }),
      t({ amount_cents: 12000 }),
      t({ amount_cents: 3000, status: 'planned' }),
      t({ kind: 'income', amount_cents: 1000, status: 'planned' }),
      t({ amount_cents: 99999, deleted_at: '2026-10-11T00:00:00Z' }),
    ])
    expect(s).toEqual({ income: 500000, expense: 12000, balance: 488000, plannedExpense: 3000, plannedIncome: 1000 })
  })

  it('saldo pode ficar negativo', () => {
    expect(summarizeMonth([t({ amount_cents: 700 })]).balance).toBe(-700)
  })
})

describe('groupByDay', () => {
  it('dias em ordem crescente, itens por ordem de criação', () => {
    const a = t({ occurred_on: '2026-10-12', created_at: '2026-10-12T09:00:00Z' })
    const b = t({ occurred_on: '2026-10-03' })
    const c = t({ occurred_on: '2026-10-12', created_at: '2026-10-12T08:00:00Z' })
    const groups = groupByDay([a, b, c])
    expect(groups.map(([d]) => d)).toEqual(['2026-10-03', '2026-10-12'])
    expect(groups[1][1].map((x) => x.id)).toEqual([c.id, a.id])
  })
})

it('signedCents', () => {
  expect(signedCents({ kind: 'expense', amount_cents: 5 })).toBe(-5)
  expect(signedCents({ kind: 'income', amount_cents: 5 })).toBe(5)
})
