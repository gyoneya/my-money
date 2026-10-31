import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MyMoneyDB } from '../db/db'
import { addTransactions, buildTransaction, createCategory, updateCategory } from '../db/repo'
import { pull, push, syncOnce, type Remote, type ServerRow, type SyncTable } from './sync'

// Nos testes, linhas soltas (qualquer tabela) com acesso livre aos campos.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = ServerRow & Record<string, any>

/** Servidor em memória que imita o Supabase (server_updated_at = relógio do servidor). */
class FakeRemote implements Remote {
  tables: Record<SyncTable, Map<string, Row>> = {
    categories: new Map(),
    recurring_rules: new Map(),
    transactions: new Map(),
  }
  upserts: SyncTable[] = []
  private clock = Date.parse('2026-10-31T12:00:00Z')

  tick() {
    this.clock += 1000
    return new Date(this.clock).toISOString()
  }

  async updatedAtOf(table: SyncTable, ids: string[]) {
    const m = new Map<string, string>()
    for (const id of ids) {
      const r = this.tables[table].get(id)
      if (r) m.set(id, r.updated_at)
    }
    return m
  }

  async upsert(table: SyncTable, rows: object[]) {
    this.upserts.push(table)
    for (const r of rows as Row[]) {
      this.tables[table].set(r.id, { ...r, user_id: 'u1', server_updated_at: this.tick() })
    }
  }

  async changedSince(table: SyncTable, cursor: string | null, limit: number) {
    return [...this.tables[table].values()]
      .filter((r) => !cursor || r.server_updated_at > cursor)
      .sort((a, b) => a.server_updated_at.localeCompare(b.server_updated_at))
      .slice(0, limit)
  }

  /** Simula outro aparelho escrevendo direto no servidor. */
  write(table: SyncTable, row: Record<string, unknown> & { id: string }) {
    this.tables[table].set(row.id, { ...row, server_updated_at: this.tick() } as Row)
  }
}

let db: MyMoneyDB
let remote: FakeRemote

beforeEach(async () => {
  db = new MyMoneyDB(`sync-${crypto.randomUUID()}`)
  await db.open()
  remote = new FakeRemote()
})

afterEach(async () => {
  await db.delete()
})

const tx = (categoryId: string, cents = 1000) =>
  buildTransaction({ kind: 'expense', amount_cents: cents, category_id: categoryId, occurred_on: '2026-10-31' })

describe('push', () => {
  it('envia pendentes, sem a flag local, e limpa a fila', async () => {
    const c = await createCategory({ kind: 'expense', name: 'Mercado' }, db)
    await addTransactions([tx(c.id)], db)

    expect(await push(db, remote)).toBe(2)
    const sent = [...remote.tables.transactions.values()][0]
    expect(sent).not.toHaveProperty('pending')
    expect(await db.transactions.where('pending').equals(1).count()).toBe(0)
    expect(await db.categories.where('pending').equals(1).count()).toBe(0)
    expect(await push(db, remote)).toBe(0)
  })

  it('envia categorias antes dos lançamentos', async () => {
    const c = await createCategory({ kind: 'expense', name: 'X' }, db)
    await addTransactions([tx(c.id)], db)
    await push(db, remote)
    expect(remote.upserts).toEqual(['categories', 'transactions'])
  })

  it('last-write-wins: não sobrescreve versão mais nova do servidor', async () => {
    const c = await createCategory({ kind: 'expense', name: 'Antigo' }, db)
    await push(db, remote)
    // Outro aparelho renomeia depois; este aparelho tinha uma edição mais antiga pendente.
    await db.categories.update(c.id, { name: 'Local velho', updated_at: '2026-10-31T10:00:00.000Z', pending: 1 })
    remote.write('categories', { ...(await db.categories.get(c.id))!, name: 'Servidor novo', updated_at: '2026-10-31T11:00:00.000Z' })

    expect(await push(db, remote)).toBe(0)
    expect(remote.tables.categories.get(c.id)!.name).toBe('Servidor novo')
    await pull(db, remote)
    expect((await db.categories.get(c.id))!.name).toBe('Servidor novo')
  })

  it('servidor fora do ar: nada sai da fila', async () => {
    await createCategory({ kind: 'expense', name: 'X' }, db)
    remote.upsert = async () => {
      throw new Error('offline')
    }
    await expect(push(db, remote)).rejects.toThrow('offline')
    expect(await db.categories.where('pending').equals(1).count()).toBe(1)
  })
})

describe('pull', () => {
  it('recebe registros de outro aparelho e avança o cursor', async () => {
    const other = new MyMoneyDB(`other-${crypto.randomUUID()}`)
    const c = await createCategory({ kind: 'income', name: 'Salário' }, other)
    await addTransactions([tx(c.id, 500000)], other)
    await push(other, remote)
    await other.delete()

    expect(await pull(db, remote)).toBe(2)
    const local = (await db.transactions.toArray())[0]
    expect(local.amount_cents).toBe(500000)
    expect(local.pending).toBe(0)
    expect(local).not.toHaveProperty('user_id')
    expect(local).not.toHaveProperty('server_updated_at')

    expect(await pull(db, remote)).toBe(0) // cursor avançou
  })

  it('não sobrescreve edição local pendente mais nova', async () => {
    const c = await createCategory({ kind: 'expense', name: 'Original' }, db)
    await push(db, remote)
    remote.write('categories', { ...(await db.categories.get(c.id))!, name: 'Servidor', updated_at: '2026-10-31T09:00:00.000Z' })
    await updateCategory(c.id, { name: 'Local novo' }, db) // updated_at = agora (mais novo)

    await pull(db, remote)
    const local = (await db.categories.get(c.id))!
    expect(local.name).toBe('Local novo')
    expect(local.pending).toBe(1)
  })

  it('exclusão (soft delete) se propaga', async () => {
    const t = tx('cat')
    await addTransactions([t], db)
    await push(db, remote)
    remote.write('transactions', { ...remote.tables.transactions.get(t.id)!, deleted_at: '2026-10-31T13:00:00.000Z', updated_at: '2026-10-31T13:00:00.000Z' })

    await pull(db, remote)
    expect((await db.transactions.get(t.id))!.deleted_at).not.toBeNull()
  })
})

describe('syncOnce', () => {
  it('dois aparelhos convergem', async () => {
    const other = new MyMoneyDB(`other-${crypto.randomUUID()}`)
    await createCategory({ kind: 'expense', name: 'A' }, db)
    await createCategory({ kind: 'expense', name: 'B' }, other)

    await syncOnce(db, remote)
    await syncOnce(other, remote)
    await syncOnce(db, remote)

    const names = async (d: MyMoneyDB) => (await d.categories.toArray()).map((c) => c.name).sort()
    expect(await names(db)).toEqual(['A', 'B'])
    expect(await names(other)).toEqual(['A', 'B'])
    await other.delete()
  })
})
