// Toda escrita vai primeiro ao IndexedDB com pending = 1; o sync envia depois.
import { addMonthsISO, todayISO } from '../lib/dates'
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

/** Categorias arquivadas do tipo (para restaurar na Config). */
export async function listArchivedCategories(kind: Kind, db: MyMoneyDB = defaultDb): Promise<Category[]> {
  const all = await db.categories.where('kind').equals(kind).toArray()
  return all.filter((c) => c.archived).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

/**
 * Troca a categoria de lugar com a vizinha (delta −1 = antes, +1 = depois na ordem).
 * Renumera a ordem do tipo inteiro; só marca para sync quem mudou de número.
 */
export async function moveCategory(id: string, delta: -1 | 1, db: MyMoneyDB = defaultDb): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    const target = await db.categories.get(id)
    if (!target) return
    const list = await listCategories(target.kind, db)
    const from = list.findIndex((c) => c.id === id)
    const to = from + delta
    if (from < 0 || to < 0 || to >= list.length) return
    ;[list[from], list[to]] = [list[to], list[from]]
    const ts = now()
    for (const [i, c] of list.entries()) {
      if (c.sort_order !== i) await db.categories.update(c.id, { sort_order: i, updated_at: ts, pending: 1 })
    }
  })
  changed()
}

/** Restaura uma categoria arquivada no fim da ordem. */
export async function restoreCategory(id: string, db: MyMoneyDB = defaultDb): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    const c = await db.categories.get(id)
    if (!c) return
    const active = await listCategories(c.kind, db)
    const last = active.reduce((max, x) => Math.max(max, x.sort_order), -1)
    await db.categories.update(id, { archived: false, sort_order: last + 1, updated_at: now(), pending: 1 })
  })
  changed()
}

/** Apaga todos os dados locais (ao sair da conta). */
export async function clearLocalData(db: MyMoneyDB = defaultDb): Promise<void> {
  await db.transaction('rw', [db.categories, db.recurring_rules, db.transactions, db.meta], async () => {
    await Promise.all([db.categories.clear(), db.recurring_rules.clear(), db.transactions.clear(), db.meta.clear()])
  })
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

export interface TransactionEdit {
  amount_cents: number
  category_id: string
  occurred_on: string
  note: string | null
}

/** Edita um lançamento (ou só esta parcela). Status acompanha a nova data. */
export async function updateTransaction(
  id: string,
  edit: TransactionEdit,
  today: string = todayISO(),
  db: MyMoneyDB = defaultDb,
): Promise<void> {
  assertAmount(edit.amount_cents)
  await db.transactions.update(id, {
    amount_cents: edit.amount_cents,
    category_id: edit.category_id,
    occurred_on: edit.occurred_on,
    note: edit.note?.trim() || null,
    status: statusFor(edit.occurred_on, today),
    updated_at: now(),
    pending: 1,
  })
  changed()
}

/** Parcelas ativas da compra, em ordem. */
export async function listInstallmentGroup(groupId: string, db: MyMoneyDB = defaultDb): Promise<Transaction[]> {
  const rows = await db.transactions.where('installment_group_id').equals(groupId).toArray()
  return rows.filter((t) => !t.deleted_at).sort((a, b) => a.installment_number! - b.installment_number!)
}

/**
 * Edita todas as parcelas: categoria e nota em todas; `amount_cents` é o novo TOTAL,
 * redistribuído entre as parcelas ativas; `occurred_on` é a nova data da compra
 * (1ª parcela) e todas as datas se deslocam a partir dela.
 */
export async function updateInstallmentGroup(
  groupId: string,
  edit: TransactionEdit,
  today: string = todayISO(),
  db: MyMoneyDB = defaultDb,
): Promise<void> {
  assertAmount(edit.amount_cents)
  await db.transaction('rw', db.transactions, async () => {
    const rows = await listInstallmentGroup(groupId, db)
    const amounts = splitAmount(edit.amount_cents, rows.length)
    if (!amounts) throw new Error('Valor menor que o número de parcelas')
    const ts = now()
    for (const [i, t] of rows.entries()) {
      const date = addMonthsISO(edit.occurred_on, t.installment_number! - 1)
      await db.transactions.update(t.id, {
        amount_cents: amounts[i],
        category_id: edit.category_id,
        occurred_on: date,
        note: edit.note?.trim() || null,
        status: statusFor(date, today),
        updated_at: ts,
        pending: 1,
      })
    }
  })
  changed()
}

/** Todas as categorias (inclusive arquivadas), para mostrar nomes no extrato. */
export async function listAllCategories(db: MyMoneyDB = defaultDb): Promise<Category[]> {
  return db.categories.toArray()
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
