import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MyMoneyDB } from './db'
import {
  addTransactions,
  buildInstallmentTransactions,
  buildTransaction,
  promotePlanned,
  countPending,
  createCategory,
  ensureLocalOwner,
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

describe('dono dos dados locais', () => {
  it('primeiro login apaga dados de teste; mesmo usuário preserva; outro usuário apaga', async () => {
    await seedCategoriesIfEmpty(db)
    expect(await ensureLocalOwner('u1', db)).toBe(true)
    expect(await db.categories.count()).toBe(0)

    await seedCategoriesIfEmpty(db)
    expect(await ensureLocalOwner('u1', db)).toBe(false)
    expect(await db.categories.count()).toBe(17)

    expect(await ensureLocalOwner('u2', db)).toBe(true)
    expect(await db.categories.count()).toBe(0)
    expect((await db.meta.get('owner_id'))!.value).toBe('u2')
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

  it('parcelado: N lançamentos ligados, 1ª realizada, futuras previstas', () => {
    const rows = buildInstallmentTransactions({ ...base, amount_cents: 10000, occurred_on: '2026-10-31' }, 3, '2026-10-31')
    expect(rows.map((r) => [r.amount_cents, r.occurred_on, r.status, r.installment_number, r.installment_total])).toEqual([
      [3334, '2026-10-31', 'done', 1, 3],
      [3333, '2026-11-30', 'planned', 2, 3],
      [3333, '2026-12-31', 'planned', 3, 3],
    ])
    expect(new Set(rows.map((r) => r.installment_group_id)).size).toBe(1)
    expect(rows[0].installment_group_id).not.toBeNull()
    expect(new Set(rows.map((r) => r.id)).size).toBe(3)
  })

  it('compra retroativa: parcelas já vencidas nascem realizadas', () => {
    const rows = buildInstallmentTransactions({ ...base, amount_cents: 300, occurred_on: '2026-08-10' }, 4, '2026-10-31')
    expect(rows.map((r) => r.status)).toEqual(['done', 'done', 'done', 'planned'])
  })

  it('1x = lançamento simples', () => {
    const rows = buildInstallmentTransactions({ ...base, occurred_on: '2026-10-31' }, 1)
    expect(rows).toHaveLength(1)
    expect(rows[0].installment_group_id).toBeNull()
  })

  it('rejeita parcelamento inválido', () => {
    const t = { ...base, occurred_on: '2026-10-31' }
    expect(() => buildInstallmentTransactions({ ...t, kind: 'income' }, 2)).toThrow()
    expect(() => buildInstallmentTransactions(t, 61)).toThrow()
    expect(() => buildInstallmentTransactions({ ...t, amount_cents: 3 }, 4)).toThrow()
  })

  it('promove previstos vencidos para realizados', async () => {
    const rows = buildInstallmentTransactions({ ...base, amount_cents: 300, occurred_on: '2026-10-31' }, 3, '2026-10-31')
    await addTransactions(rows, db)
    await softDeleteTransactions([rows[2].id], db)
    await db.transactions.update(rows[1].id, { pending: 0 })

    expect(await promotePlanned('2026-11-29', db)).toBe(0)
    expect(await promotePlanned('2026-12-31', db)).toBe(1) // a 3ª foi excluída
    const second = (await db.transactions.get(rows[1].id))!
    expect(second.status).toBe('done')
    expect(second.pending).toBe(1)
    expect((await db.transactions.get(rows[2].id))!.status).toBe('planned')
  })

  it('conta pendentes de sync', async () => {
    await addTransactions([buildTransaction({ ...base, occurred_on: '2026-10-31' })], db)
    await createCategory({ kind: 'expense', name: 'X' }, db)
    expect(await countPending(db)).toBe(2)
  })
})
