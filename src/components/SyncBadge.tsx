import { useSyncState } from '../sync/manager'
import { Icon } from './Icon'

/** Indicador discreto: só aparece quando há algo ainda não enviado ao servidor. */
export function SyncBadge() {
  const { pending, syncing, failed } = useSyncState()
  if (pending === 0) return null
  return (
    <span
      className={`flex items-center gap-1 text-xs ${failed ? 'text-warning' : 'text-muted'}`}
      title={failed ? 'Sem conexão: será enviado quando voltar' : 'Enviando…'}
    >
      <Icon name={syncing ? 'sync' : 'cloudOff'} className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
      {pending} não sincronizado{pending > 1 ? 's' : ''}
    </span>
  )
}
