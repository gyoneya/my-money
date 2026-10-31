import { MAX_INSTALLMENTS, splitAmount } from '../lib/installments'
import { formatBRL } from '../lib/money'
import { Sheet } from './Sheet'

const OPTIONS = Array.from({ length: MAX_INSTALLMENTS }, (_, i) => i + 1)

export function InstallmentsSheet({
  value,
  totalCents,
  onPick,
  onClose,
}: {
  value: number
  totalCents: number
  onPick: (n: number) => void
  onClose: () => void
}) {
  return (
    <Sheet title="Parcelas" onClose={onClose}>
      <p className="-mt-2 mb-3 text-xs text-muted">
        {totalCents > 0 ? `Total ${formatBRL(totalCents)}, 1ª parcela na data da compra` : 'Digite o valor total da compra'}
      </p>
      <div className="grid grid-cols-4 gap-1.5">
        {OPTIONS.map((n) => {
          const parts = totalCents > 0 ? splitAmount(totalCents, n) : null
          const disabled = totalCents > 0 && !parts
          const active = n === value
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onPick(n)}
              className={`flex flex-col items-center rounded-xl py-2 disabled:opacity-25 ${
                active ? 'bg-brand-soft text-brand ring-1 ring-brand' : 'bg-surface-2 text-text active:bg-line'
              }`}
            >
              <span className="text-base font-semibold">{n === 1 ? 'À vista' : `${n}x`}</span>
              {parts && <span className="text-[0.65rem] text-muted tabular-nums">{formatBRL(parts[parts.length - 1])}</span>}
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}
