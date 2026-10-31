// Contas recorrentes: a regra gera lançamentos `planned` para os próximos 12 meses.
import { addMonthsISO, monthKey, todayISO } from '../lib/dates'
import { MAX_CENTS } from '../lib/money'
import { firstMonthFor, instanceId, occurrenceDate, ruleMonths } from '../lib/recurring'
import { db as defaultDb, type MyMoneyDB } from './db'
import { emitDataChange } from './events'
import { newId, statusFor } from './repo'
import type { Kind, RecurringRule, Transaction } from './types'

const now = () => new Date().toISOString()

export interface RuleInput {
  kind: Kind
  amount_cents: number
  category_id: string
  day_of_month: number
  note: string | null
}

function validate(input: RuleInput) {
  if (!Number.isSafeInteger(input.amount_cents) || input.amount_cents <= 0 || input.amount_cents > MAX_CENTS) {
    throw new Error('Valor inválido')
  }
  if (!Number.isInteger(input.day_of_month) || input.day_of_month < 1 || input.day_of_month > 31) {
    throw new Error('Dia inválido')
  }
}

/** Regras ativas (não excluídas), encerradas por último. */
export async function listRecurringRules(db: MyMoneyDB = defaultDb): Promise<RecurringRule[]> {
  const rules = (await db.recurring_rules.toArray()).filter((r) => !r.deleted_at)
  return rules.sort((a, b) => Number(!!a.end_month) - Number(!!b.end_month) || a.day_of_month - b.day_of_month)
}

/** Meses e ids da regra. Calculado FORA da transação do Dexie (crypto.subtle a encerraria). */
async function planOf(rule: RecurringRule, today: string): Promise<{ month: string; id: string }[]> {
  const months = rule.deleted_at ? [] : ruleMonths(rule, today)
  return Promise.all(months.map(async (month) => ({ month, id: await instanceId(rule.id, month) })))
}

/**
 * Garante os lançamentos da regra até o horizonte.
 * - Mês sem lançamento: cria (se o usuário excluiu um mês, o id existe e ele não volta).
 * - `overwriteFuture`: previstos futuros recebem os dados novos da regra, e os que
 *   ficaram fora do plano (regra encerrada) são excluídos.
 */
async function materialize(
  rule: RecurringRule,
  plan: { month: string; id: string }[],
  today: string,
  overwriteFuture: boolean,
  db: MyMoneyDB,
): Promise<number> {
  let changed = 0
  const ts = now()
  for (const { month, id } of plan) {
    const date = occurrenceDate(month, rule.day_of_month)
    const existing = await db.transactions.get(id)
    const fields = {
      kind: rule.kind,
      amount_cents: rule.amount_cents,
      category_id: rule.category_id,
      occurred_on: date,
      note: rule.note,
      status: statusFor(date, today),
    }
    if (!existing) {
      const row: Transaction = {
        id,
        ...fields,
        installment_group_id: null,
        installment_number: null,
        installment_total: null,
        recurring_rule_id: rule.id,
        created_at: ts,
        updated_at: ts,
        deleted_at: null,
        pending: 1,
      }
      await db.transactions.add(row)
      changed++
    } else if (overwriteFuture && !existing.deleted_at && existing.status === 'planned' && date > today) {
      await db.transactions.update(id, { ...fields, updated_at: ts, pending: 1 })
      changed++
    }
  }

  if (overwriteFuture) {
    const keep = new Set(plan.map((p) => p.id))
    const stale = await db.transactions
      .where('recurring_rule_id')
      .equals(rule.id)
      .filter((t) => !keep.has(t.id) && !t.deleted_at && t.status === 'planned' && t.occurred_on > today)
      .toArray()
    for (const t of stale) await db.transactions.update(t.id, { deleted_at: ts, updated_at: ts, pending: 1 })
    changed += stale.length
  }
  return changed
}

export async function createRecurringRule(
  input: RuleInput,
  today: string = todayISO(),
  db: MyMoneyDB = defaultDb,
): Promise<RecurringRule> {
  validate(input)
  const rule: RecurringRule = {
    id: newId(),
    ...input,
    note: input.note?.trim() || null,
    start_month: `${firstMonthFor(input.day_of_month, today)}-01`,
    end_month: null,
    updated_at: now(),
    deleted_at: null,
    pending: 1,
  }
  const plan = await planOf(rule, today)
  await db.transaction('rw', db.recurring_rules, db.transactions, async () => {
    await db.recurring_rules.add(rule)
    await materialize(rule, plan, today, false, db)
  })
  emitDataChange('local')
  return rule
}

/** Editar a regra recria os previstos futuros. O que já passou não muda. */
export async function updateRecurringRule(
  id: string,
  input: RuleInput,
  today: string = todayISO(),
  db: MyMoneyDB = defaultDb,
): Promise<void> {
  validate(input)
  const rule = await db.recurring_rules.get(id)
  if (!rule) return
  const updated: RecurringRule = { ...rule, ...input, note: input.note?.trim() || null, updated_at: now(), pending: 1 }
  const plan = await planOf(updated, today)
  await db.transaction('rw', db.recurring_rules, db.transactions, async () => {
    await db.recurring_rules.put(updated)
    await materialize(updated, plan, today, true, db)
  })
  emitDataChange('local')
}

/**
 * Encerra a regra: a ocorrência deste mês fica se já aconteceu; as futuras somem.
 * Regra que nunca gerou nada é excluída.
 */
export async function endRecurringRule(id: string, today: string = todayISO(), db: MyMoneyDB = defaultDb): Promise<void> {
  const rule = await db.recurring_rules.get(id)
  if (!rule) return
  const current = monthKey(today)
  const lastMonth =
    occurrenceDate(current, rule.day_of_month) <= today ? current : monthKey(addMonthsISO(`${current}-01`, -1))
  const ts = now()
  const ended: RecurringRule =
    lastMonth < monthKey(rule.start_month)
      ? { ...rule, deleted_at: ts, updated_at: ts, pending: 1 }
      : { ...rule, end_month: `${lastMonth}-01`, updated_at: ts, pending: 1 }
  const plan = await planOf(ended, today)
  await db.transaction('rw', db.recurring_rules, db.transactions, async () => {
    await db.recurring_rules.put(ended)
    await materialize(ended, plan, today, true, db)
  })
  emitDataChange('local')
}

/** Ao abrir o app: completa o horizonte de 12 meses de todas as regras ativas. */
export async function topUpRecurring(today: string = todayISO(), db: MyMoneyDB = defaultDb): Promise<number> {
  const rules = await listRecurringRules(db)
  const plans = await Promise.all(rules.map((r) => planOf(r, today)))
  let created = 0
  await db.transaction('rw', db.recurring_rules, db.transactions, async () => {
    for (const [i, rule] of rules.entries()) created += await materialize(rule, plans[i], today, false, db)
  })
  if (created) emitDataChange('local')
  return created
}
