import { supabase } from '../lib/supabase'
import type { Remote, ServerRow, SyncTable } from './sync'

// Filtro `in` vai na URL: lotes pequenos para não estourar o tamanho.
const IN_CHUNK = 100

export const supabaseRemote: Remote = {
  async updatedAtOf(table: SyncTable, ids: string[]) {
    const result = new Map<string, string>()
    for (let i = 0; i < ids.length; i += IN_CHUNK) {
      const { data, error } = await supabase
        .from(table)
        .select('id, updated_at')
        .in('id', ids.slice(i, i + IN_CHUNK))
      if (error) throw error
      for (const r of data as { id: string; updated_at: string }[]) result.set(r.id, r.updated_at)
    }
    return result
  },

  async upsert(table: SyncTable, rows: object[]) {
    const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' })
    if (error) throw error
  },

  async changedSince(table: SyncTable, cursor: string | null, limit: number) {
    let q = supabase.from(table).select('*').order('server_updated_at', { ascending: true }).limit(limit)
    if (cursor) q = q.gt('server_updated_at', cursor)
    const { data, error } = await q
    if (error) throw error
    return data as ServerRow[]
  },
}
