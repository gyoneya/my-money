import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { firstMonthFor, instanceId, occurrenceDate, ruleMonths } from '../lib/recurring'
import { MyMoneyDB } from './db'
import { createRecurringRule, endRecurringRule, listRecurringRules, topUpRecurring, updateRecurringRule } from './recurring'
import { softDeleteTransactions } from './repo'

describe('regras puras', () => {
  it('dia inexistente vira último dia do mês', () => {
    expect(occurrenceDate('2026-02', 31)).toBe('2026-02-28')
    expect(occurrenceDate('2028-02', 30)).toBe('2028-02-29')
    expect(occurrenceDate('2026-10', 5)).toBe('2026-10-05')
  })

  it('regra nova começa no mês atual só se o dia ainda não passou', () => {
    expect(firstMonthFor(31, '2026-10-31')).toBe('2026-10')
    expect(firstMonthFor(5, '2026-10-31')).toBe('2026-11')
    expect(firstMonthFor(31, '2026-11-30')).toBe('2026-11') // 31 → 30/11 = hoje
  })

  it('meses: do início ao horizonte de 12 (ou ao fim da regra)', () => {
    const m = ruleMonths({ start_month: '2026-11-01', end_month: null }, '2026-10-31')
    expect([m.length, m[0], m.at(-1)]).toEqual([11, '2026-11', '2027-09'])
    expect(ruleMonths({ start_month: '2026-11-01', end_month: '2027-01-01' }, '2026-10-31')).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
    ])
    expect(ruleMonths({ start_month: '2026-11-01', end_month: '2026-10-01' }, '2026-10-31')).toEqual([])
  })

  it('id determinístico e no formato UUID', async () => {
    const a = await instanceId('r1', '2026-11')
    expect(a).toBe(await instanceId('r1', '2026-11'))
    expect(a).not.toBe(await instanceId('r1', '2026-12'))
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})

let db: MyMoneyDB
beforeEach(async () => {
  db = new MyMoneyDB(`rec-${crypto.randomUUID()}`)
  await db.open()
})
afterEach(async () => {
  await db.delete()
})

const rent = { kind: 'expense' as const, amount_cents: 200000, category_id: 'moradia', day_of_month: 10, note: 'Aluguel' }
const TODAY = '2026-10-31'

async function instances(ruleId: string) {
  const rows = await db.transactions.where('recurring_rule_id').equals(ruleId).toArray()
  return rows.filter((t) => !t.deleted_at).sort((a, b) => a.occurred_on.localeCompare(b.occurred_on))
}

describe('motor de recorrentes', () => {
  it('cria previstos dos próximos meses, sem o mês cujo dia já passou', async () => {
    const r = await createRecurringRule(rent, TODAY, db)
    const rows = await instances(r.id)
    expect(r.start_month).toBe('2026-11-01')
    expect(rows).toHaveLength(11) // nov/2026 → set/2027
    expect(rows[0]).toMatchObject({ occurred_on: '2026-11-10', status: 'planned', amount_cents: 200000, note: 'Aluguel', pending: 1 })
  })

  it('renovar ao abrir: completa o horizonte sem duplicar', async () => {
    const r = await createRecurringRule(rent, TODAY, db)
    expect(await topUpRecurring(TODAY, db)).toBe(0)
    // Dois meses depois: as que venceram já existem; entram 2 meses novos no fim.
    expect(await topUpRecurring('2026-12-31', db)).toBe(2)
    expect((await instances(r.id)).at(-1)!.occurred_on).toBe('2027-11-10')
  })

  it('mês excluído pelo usuário não volta', async () => {
    const r = await createRecurringRule(rent, TODAY, db)
    const [first] = await instances(r.id)
    await softDeleteTransactions([first.id], db)
    await topUpRecurring(TODAY, db)
    expect((await instances(r.id))[0].occurred_on).toBe('2026-12-10')
  })

  it('editar a regra atualiza só os previstos futuros', async () => {
    const r = await createRecurringRule({ ...rent, day_of_month: 31 }, '2026-10-01', db)
    // Outubro (31/10) já venceu quando editamos em 31/10: fica como estava.
    await updateRecurringRule(r.id, { ...rent, amount_cents: 210000, day_of_month: 5 }, '2026-10-31', db)
    const rows = await instances(r.id)
    expect(rows[0]).toMatchObject({ occurred_on: '2026-10-31', amount_cents: 200000 })
    expect(rows[1]).toMatchObject({ occurred_on: '2026-11-05', amount_cents: 210000 })
    expect(rows.every((t, i) => i === 0 || t.amount_cents === 210000)).toBe(true)
  })

  it('encerrar remove os futuros e mantém o histórico', async () => {
    const r = await createRecurringRule(rent, '2026-09-01', db) // set/2026 → ago/2027
    await endRecurringRule(r.id, '2026-10-31', db) // dia 10 de outubro já passou: outubro fica
    const rows = await instances(r.id)
    expect(rows.map((t) => t.occurred_on)).toEqual(['2026-09-10', '2026-10-10'])
    expect((await db.recurring_rules.get(r.id))!.end_month).toBe('2026-10-01')
    expect(await topUpRecurring('2027-01-31', db)).toBe(0)
  })

  it('encerrar regra que nunca gerou nada a exclui', async () => {
    const r = await createRecurringRule(rent, TODAY, db) // começa em novembro
    await endRecurringRule(r.id, TODAY, db)
    expect(await instances(r.id)).toHaveLength(0)
    expect(await listRecurringRules(db)).toHaveLength(0)
  })

  it('valida valor e dia', async () => {
    await expect(createRecurringRule({ ...rent, amount_cents: 0 }, TODAY, db)).rejects.toThrow()
    await expect(createRecurringRule({ ...rent, day_of_month: 32 }, TODAY, db)).rejects.toThrow()
  })
})
