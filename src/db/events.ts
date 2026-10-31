// Aviso de "dados mudaram": telas recarregam e o sync agenda um envio.
export type ChangeSource = 'local' | 'remote'
type Listener = (source: ChangeSource) => void

const listeners = new Set<Listener>()

export function onDataChange(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function emitDataChange(source: ChangeSource): void {
  for (const fn of listeners) fn(source)
}
