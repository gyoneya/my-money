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
          {k === 'back' ? (
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 5H9l-6 7 6 7h12zM17 9l-6 6M11 9l6 6" />
            </svg>
          ) : (
            k
          )}
        </button>
      ))}
    </div>
  )
}
