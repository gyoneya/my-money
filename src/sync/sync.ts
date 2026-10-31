// Sync offline-first:
// - push: registros com pending = 1 vão ao servidor (upsert por id). Last-write-wins por
//   updated_at: se o servidor já tem versão mais nova, o envio local é descartado.
// - pull: busca o que mudou no servidor desde o último cursor (server_updated_at, relógio
//   do servidor), sem sobrescrever alteração local pendente mais nova.
import type { MyMoneyDB } from '../db/db'
import type { Category, RecurringRule, Transaction } from '../db/types'

/** Ordem importa: categorias antes de recorrentes antes de lançamentos (chaves estrangeiras). */
export const SYNC_TABLES = ['categories', 'recurring_rules', 'transactions'] as const
export type SyncTable = (typeof SYNC_TABLES)[number]

type LocalRow = Category | RecurringRule | Transaction
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never
type WireRow = DistributiveOmit<LocalRow, 'pending'>
export type ServerRow = WireRow & { server_updated_at: string; user_id?: string }

/** Acesso ao servidor (Supabase em produção, memória nos testes). */
export interface Remote {
  /** updated_at atual no servidor para os ids informados (ausentes = não existem). */
  updatedAtOf(table: SyncTable, ids: string[]): Promise<Map<string, string>>
  upsert(table: SyncTable, rows: WireRow[]): Promise<void>
  /** Linhas com server_updated_at > cursor, em ordem crescente. */
  changedSince(table: SyncTable, cursor: string | null, limit: number): Promise<ServerRow[]>
}

const PAGE = 500
const time = (iso: string) => Date.parse(iso)

function stripLocal(row: LocalRow): WireRow {
  const { pending: _pending, ...rest } = row
  return rest as WireRow
}

function toLocal(row: ServerRow): LocalRow {
  const { server_updated_at: _s, user_id: _u, ...rest } = row
  return { ...rest, pending: 0 } as LocalRow
}

export async function push(db: MyMoneyDB, remote: Remote): Promise<number> {
  let sent = 0
  for (const table of SYNC_TABLES) {
    const store = db[table]
    const pending = (await store.where('pending').equals(1).toArray()) as LocalRow[]
    for (let i = 0; i < pending.length; i += PAGE) {
      const batch = pending.slice(i, i + PAGE)
      const serverTimes = await remote.updatedAtOf(table, batch.map((r) => r.id))
      const winners = batch.filter((r) => {
        const s = serverTimes.get(r.id)
        return !s || time(r.updated_at) >= time(s)
      })
      if (winners.length) await remote.upsert(table, winners.map(stripLocal))
      sent += winners.length

      // Limpa a flag só se o registro não mudou durante o envio. Os perdedores
      // também saem da fila: a versão mais nova do servidor chega pelo pull.
      await db.transaction('rw', store, async () => {
        for (const r of batch) {
          const current = (await store.get(r.id)) as LocalRow | undefined
          if (current && current.updated_at === r.updated_at) await store.update(r.id, { pending: 0 })
        }
      })
    }
  }
  return sent
}

export async function pull(db: MyMoneyDB, remote: Remote): Promise<number> {
  let received = 0
  for (const table of SYNC_TABLES) {
    const store = db[table]
    const cursorKey = `pull:${table}`
    let cursor = (await db.meta.get(cursorKey))?.value ?? null

    for (;;) {
      const rows = await remote.changedSince(table, cursor, PAGE)
      if (!rows.length) break

      await db.transaction('rw', [store, db.meta], async () => {
        for (const row of rows) {
          const local = (await store.get(row.id)) as LocalRow | undefined
          const localWins = local?.pending === 1 && time(local.updated_at) > time(row.updated_at)
          if (!localWins) await store.put(toLocal(row) as never)
        }
        cursor = rows[rows.length - 1].server_updated_at
        await db.meta.put({ key: cursorKey, value: cursor })
      })
      received += rows.length
      if (rows.length < PAGE) break
    }
  }
  return received
}

/** Envia e depois recebe. */
export async function syncOnce(db: MyMoneyDB, remote: Remote): Promise<{ sent: number; received: number }> {
  const sent = await push(db, remote)
  const received = await pull(db, remote)
  return { sent, received }
}
