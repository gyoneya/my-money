// Quando sincronizar: ao abrir o app, ao voltar a conexão, ao voltar para o app,
// pouco depois de cada escrita local e a cada minuto com o app aberto.
import { useSyncExternalStore } from 'react'
import { db } from '../db/db'
import { emitDataChange, onDataChange } from '../db/events'
import { countPending } from '../db/repo'
import { supabaseRemote } from './supabaseRemote'
import { syncOnce } from './sync'

export interface SyncState {
  syncing: boolean
  pending: number
  /** Última tentativa falhou (sem internet, servidor fora...). */
  failed: boolean
}

let state: SyncState = { syncing: false, pending: 0, failed: false }
const listeners = new Set<() => void>()

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch }
  for (const fn of listeners) fn()
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )
}

let running: Promise<void> | null = null
let again = false

/** Sincroniza agora (uma por vez; se pedirem durante, roda de novo no fim). */
export function syncNow(): Promise<void> {
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    do {
      again = false
      if (!navigator.onLine) {
        setState({ failed: true })
        break
      }
      setState({ syncing: true })
      try {
        const { received } = await syncOnce(db, supabaseRemote)
        setState({ failed: false })
        if (received) emitDataChange('remote')
      } catch (e) {
        console.warn('sync falhou', e)
        setState({ failed: true })
        break
      } finally {
        setState({ syncing: false, pending: await countPending() })
      }
    } while (again)
  })().finally(() => {
    running = null
  })
  return running
}

let timer: ReturnType<typeof setTimeout> | undefined

/** Agenda um sync em breve (junta várias escritas seguidas num envio só). */
export function requestSync(delayMs = 1500): void {
  clearTimeout(timer)
  timer = setTimeout(() => void syncNow(), delayMs)
}

/** Liga os disparos automáticos. Retorna função para desligar (logout). */
export function startSync(): () => void {
  const offChange = onDataChange((source) => {
    if (source !== 'local') return
    void countPending().then((pending) => setState({ pending }))
    requestSync()
  })
  const onOnline = () => void syncNow()
  const onVisible = () => document.visibilityState === 'visible' && void syncNow()
  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVisible)
  const interval = setInterval(() => document.visibilityState === 'visible' && void syncNow(), 60_000)

  void syncNow()

  return () => {
    offChange()
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVisible)
    clearInterval(interval)
    clearTimeout(timer)
  }
}
