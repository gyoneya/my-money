import { Icon } from './Icon'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'back'] as const

export function Keypad({ onKey }: { onKey: (key: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onKey(k)}
          aria-label={k === 'back' ? 'Apagar' : k}
          className="flex h-14 items-center justify-center rounded-xl bg-surface text-2xl font-medium text-text active:bg-surface-2"
        >
          {k === 'back' ? <Icon name="back" className="h-6 w-6" /> : k}
        </button>
      ))}
    </div>
  )
}
