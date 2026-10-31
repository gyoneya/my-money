import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MyMoneyDB } from './db'
import {
  addTransactions,
  buildTransaction,
  countPending,
  createCategory,
  listCategories,
  listTransactionsOfMonth,
  seedCategoriesIfEmpty,
  softDeleteTransactions,
  statusFor,
  updateCategory,
} from './repo'

let db: MyMoneyDB

beforeEach(async () => {
  db = new MyMoneyDB(`test-${crypto.randomUUID()}`)
  await db.open()
})

afterEach(async () => {
  await db.delete()
})

describe('categorias', () => {
  it('seed cria 12 de despesa e 5 de receita, só uma vez', async () => {
    expect(await seedCategoriesIfEmpty(db)).toBe(true)
    expect(await seedCategoriesIfEmpty(db)).toBe(false)
    const exp = await listCategories('expense', db)
    const inc = await listCategories('income', db)
    expect(exp).toHaveLength(12)
    expect(inc).toHaveLength(5)
    expect(exp[0].name).toBe('Mercado')
    expect(exp.at(-1)!.name).toBe('Outros')
    expect(exp.every((c) => c.pending === 1)).toBe(true)
  })

  it('nova categoria vai para o fim do seu tipo', async () => {
    await seedCategoriesIfEmpty(db)
    const c = await createCategory({ kind: 'expense', name: '  Café ', icon: '☕' }, db)
    expect(c.name).toBe('Café')
    const exp = await listCategories('expense', db)
    expect(exp.at(-1)!.id).toBe(c.id)
  })

  it('rejeita nome vazio', async () => {
    await expect(createCategory({ kind: 'expense', name: '  ' }, db)).rejects.toThrow()
  })

  it('arquivada some da lista', async () => {
    const c = await createCategory({ kind: 'income', name: 'Bico' }, db)
    await db.categories.update(c.id, { pending: 0 })
    await updateCategory(c.id, { archived: true }, db)
    expect(await listCategories('income', db)).toHaveLength(0)
    expect((await db.categories.get(c.id))!.pending).toBe(1)
  })
})

describe('lançamentos', () => {
  const base = { kind: 'expense' as const, amount_cents: 1234, category_id: 'cat' }

  it('status: até hoje = done, futuro = planned', () => {
    expect(statusFor('2026-10-31', '2026-10-31')).toBe('done')
    expect(statusFor('2026-10-01', '2026-10-31')).toBe('done')
    expect(statusFor('2026-11-01', '2026-10-31')).toBe('planned')
  })

  it('valida o valor', () => {
    expect(() => buildTransaction({ ...base, amount_cents: 0, occurred_on: '2026-10-31' })).toThrow()
    expect(() => buildTransaction({ ...base, amount_cents: 12.5, occurred_on: '2026-10-31' })).toThrow()
  })

  it('nota vazia vira null', () => {
    expect(buildTransaction({ ...base, occurred_on: '2026-10-31', note: '  ' }).note).toBeNull()
  })

  it('salva, lista do mês e exclui (soft delete)', async () => {
    const a = buildTransaction({ ...base, occurred_on: '2026-10-31' })
    const b = buildTransaction({ ...base, occurred_on: '2026-10-01' })
    const c = buildTransaction({ ...base, occurred_on: '2026-11-01' })
    await addTransactions([a, b, c], db)

    expect((await listTransactionsOfMonth('2026-10', db)).map((t) => t.id)).toEqual([b.id, a.id])

    await softDeleteTransactions([a.id], db)
    expect((await listTransactionsOfMonth('2026-10', db)).map((t) => t.id)).toEqual([b.id])
    expect((await db.transactions.get(a.id))!.deleted_at).not.toBeNull()
  })

  it('conta pendentes de sync', async () => {
    await addTransactions([buildTransaction({ ...base, occurred_on: '2026-10-31' })], db)
    await createCategory({ kind: 'expense', name: 'X' }, db)
    expect(await countPending(db)).toBe(2)
  })
})
