// Toda escrita vai primeiro ao IndexedDB com pending = 1; o sync envia depois.
import { todayISO } from '../lib/dates'
import { installmentDates, MAX_INSTALLMENTS, MIN_INSTALLMENTS, splitAmount } from '../lib/installments'
import { MAX_CENTS } from '../lib/money'
import { db as defaultDb, type MyMoneyDB } from './db'
import { emitDataChange } from './events'
import { SEED_CATEGORIES } from './seed'
import type { Category, Kind, Status, Transaction } from './types'

const now = () => new Date().toISOString()

/** Avisa telas e sync que houve escrita local. Repassa o valor para uso em `.then`. */
function changed<T>(value?: T): T {
  emitDataChange('local')
  return value as T
}
export const newId = () => crypto.randomUUID()

/** Lançamento com data futura nasce previsto; até hoje, realizado. */
export function statusFor(occurredOn: string, today: string = todayISO()): Status {
  return occurredOn > today ? 'planned' : 'done'
}

function assertAmount(cents: number) {
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > MAX_CENTS) {
    throw new Error(`Valor inválido: ${cents}`)
  }
}

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------

/** Categorias ativas do tipo, na ordem definida pelo usuário. */
export async function listCategories(kind: Kind, db: MyMoneyDB = defaultDb): Promise<Category[]> {
  const all = await db.categories.where('kind').equals(kind).toArray()
  return all.filter((c) => !c.archived).sort((a, b) => a.sort_order - b.sort_order)
}

export async function createCategory(
  input: { kind: Kind; name: string; icon?: string | null },
  db: MyMoneyDB = defaultDb,
): Promise<Category> {
  const name = input.name.trim()
  if (!name) throw new Error('Nome obrigatório')
  return db.transaction('rw', db.categories, async () => {
    const same = await db.categories.where('kind').equals(input.kind).toArray()
    const category: Category = {
      id: newId(),
      kind: input.kind,
      name,
      icon: input.icon?.trim() || null,
      sort_order: same.reduce((max, c) => Math.max(max, c.sort_order), -1) + 1,
      monthly_budget_cents: null,
      archived: false,
      updated_at: now(),
      pending: 1,
    }
    await db.categories.add(category)
    return category
  }).then(changed)
}

export async function updateCategory(
  id: string,
  patch: Partial<Pick<Category, 'name' | 'icon' | 'sort_order' | 'monthly_budget_cents' | 'archived'>>,
  db: MyMoneyDB = defaultDb,
): Promise<void> {
  if (patch.name !== undefined && !patch.name.trim()) throw new Error('Nome obrigatório')
  await db.categories.update(id, { ...patch, updated_at: now(), pending: 1 })
  changed()
}

/** Cria as categorias iniciais se ainda não houver nenhuma. Retorna true se criou. */
export async function seedCategoriesIfEmpty(db: MyMoneyDB = defaultDb): Promise<boolean> {
  return db.transaction('rw', db.categories, async () => {
    if ((await db.categories.count()) > 0) return false
    const ts = now()
    const rows: Category[] = (Object.keys(SEED_CATEGORIES) as Kind[]).flatMap((kind) =>
      SEED_CATEGORIES[kind].map(([name, icon], i) => ({
        id: newId(),
        kind,
        name,
        icon,
        sort_order: i,
        monthly_budget_cents: null,
        archived: false,
        updated_at: ts,
        pending: 1 as const,
      })),
    )
    await db.categories.bulkAdd(rows)
    return true
  }).then((created) => (created ? changed(created) : created))
}

// ---------------------------------------------------------------------------
// Lançamentos
// ---------------------------------------------------------------------------

export interface NewTransaction {
  kind: Kind
  amount_cents: number
  category_id: string
  occurred_on: string
  note?: string | null
}

export function buildTransaction(input: NewTransaction, today: string = todayISO()): Transaction {
  assertAmount(input.amount_cents)
  const ts = now()
  return {
    id: newId(),
    kind: input.kind,
    status: statusFor(input.occurred_on, today),
    amount_cents: input.amount_cents,
    category_id: input.category_id,
    occurred_on: input.occurred_on,
    note: input.note?.trim() || null,
    installment_group_id: null,
    installment_number: null,
    installment_total: null,
    recurring_rule_id: null,
    created_at: ts,
    updated_at: ts,
    deleted_at: null,
    pending: 1,
  }
}

/**
 * Compra parcelada: N lançamentos ligados por installment_group_id.
 * `amount_cents` é o TOTAL da compra. Parcelas futuras nascem `planned`.
 */
export function buildInstallmentTransactions(
  input: NewTransaction,
  n: number,
  today: string = todayISO(),
): Transaction[] {
  if (n === 1) return [buildTransaction(input, today)]
  if (input.kind !== 'expense') throw new Error('Parcelamento só para despesa')
  if (!Number.isInteger(n) || n < MIN_INSTALLMENTS || n > MAX_INSTALLMENTS) {
    throw new Error(`Parcelas inválidas: ${n}`)
  }
  assertAmount(input.amount_cents)
  const amounts = splitAmount(input.amount_cents, n)
  if (!amounts) throw new Error('Valor menor que o número de parcelas')
  const dates = installmentDates(input.occurred_on, n)
  const groupId = newId()
  return amounts.map((amount, i) => ({
    ...buildTransaction({ ...input, amount_cents: amount, occurred_on: dates[i] }, today),
    installment_group_id: groupId,
    installment_number: i + 1,
    installment_total: n,
  }))
}

/** `planned` com data ≤ hoje vira `done`. Roda ao abrir o app. Retorna quantos mudaram. */
export async function promotePlanned(today: string = todayISO(), db: MyMoneyDB = defaultDb): Promise<number> {
  return db.transaction('rw', db.transactions, async () => {
    const due = await db.transactions
      .where('status')
      .equals('planned')
      .filter((t) => t.occurred_on <= today && !t.deleted_at)
      .toArray()
    const ts = now()
    for (const t of due) await db.transactions.update(t.id, { status: 'done', updated_at: ts, pending: 1 })
    return due.length
  }).then((n) => (n ? changed(n) : n))
}

export async function addTransactions(rows: Transaction[], db: MyMoneyDB = defaultDb): Promise<void> {
  await db.transactions.bulkAdd(rows)
  changed()
}

/** Soft delete (necessário para o sync propagar a exclusão). Usado também pelo "Desfazer". */
export async function softDeleteTransactions(ids: string[], db: MyMoneyDB = defaultDb): Promise<void> {
  const ts = now()
  await db.transaction('rw', db.transactions, async () => {
    for (const id of ids) await db.transactions.update(id, { deleted_at: ts, updated_at: ts, pending: 1 })
  })
  changed()
}

/** Lançamentos não excluídos com data dentro do mês `AAAA-MM`, ordenados por data. */
export async function listTransactionsOfMonth(month: string, db: MyMoneyDB = defaultDb): Promise<Transaction[]> {
  const rows = await db.transactions
    .where('occurred_on')
    .between(`${month}-01`, `${month}-31`, true, true)
    .toArray()
  return rows.filter((t) => !t.deleted_at).sort((a, b) => a.occurred_on.localeCompare(b.occurred_on))
}

// ---------------------------------------------------------------------------
// Dono dos dados locais
// ---------------------------------------------------------------------------

/**
 * Garante que os dados locais pertencem ao usuário logado. No primeiro login
 * (ou troca de usuário) apaga tudo que havia no aparelho. Retorna true se apagou.
 */
export async function ensureLocalOwner(userId: string, db: MyMoneyDB = defaultDb): Promise<boolean> {
  return db.transaction('rw', [db.categories, db.recurring_rules, db.transactions, db.meta], async () => {
    const owner = await db.meta.get('owner_id')
    if (owner?.value === userId) return false
    await Promise.all([db.categories.clear(), db.recurring_rules.clear(), db.transactions.clear(), db.meta.clear()])
    await db.meta.put({ key: 'owner_id', value: userId })
    return true
  })
}

/** Quantos registros ainda não foram enviados ao servidor. */
export async function countPending(db: MyMoneyDB = defaultDb): Promise<number> {
  const [c, r, t] = await Promise.all([
    db.categories.where('pending').equals(1).count(),
    db.recurring_rules.where('pending').equals(1).count(),
    db.transactions.where('pending').equals(1).count(),
  ])
  return c + r + t
}
