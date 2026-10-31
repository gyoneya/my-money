import { useState } from 'react'
import { MAX_INSTALLMENTS, splitAmount } from '../lib/installments'
import { formatBRL } from '../lib/money'
import { Sheet } from './Sheet'

const COLS = 4
const QUICK_MAX = 12

/**
 * Alcance do polegar: "À vista" no canto de baixo à direita; os números crescem
 * para a esquerda e para cima. Acima de 12x, "Outro" abre um campo numérico.
 */
function quickLayout(): number[] {
  const rows: number[][] = []
  for (let start = 1; start <= QUICK_MAX; start += COLS) {
    rows.push(Array.from({ length: COLS }, (_, i) => start + i).reverse())
  }
  return rows.reverse().flat()
}

const QUICK = quickLayout()

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
  const [custom, setCustom] = useState(value > QUICK_MAX ? String(value) : '')
  const customN = Number(custom)
  const customValid =
    Number.isInteger(customN) &&
    customN > QUICK_MAX &&
    customN <= MAX_INSTALLMENTS &&
    (totalCents === 0 || splitAmount(totalCents, customN) !== null)

  return (
    <Sheet title="Parcelas" onClose={onClose}>
      <p className="-mt-2 mb-3 text-xs text-muted">
        {totalCents > 0 ? `Total ${formatBRL(totalCents)}, 1ª parcela na data da compra` : 'Digite o valor total da compra'}
      </p>

      {/* Outro número (menos usado: fica em cima) */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (customValid) onPick(customN)
        }}
        className="mb-1.5 flex gap-1.5"
      >
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          value={custom}
          onChange={(e) => setCustom(e.target.value.replace(/\D/g, '').slice(0, 2))}
          placeholder={`Outro (13 a ${MAX_INSTALLMENTS})`}
          aria-label="Outro número de parcelas"
          className={`min-w-0 flex-1 rounded-xl border bg-surface-2 px-4 py-2.5 text-base text-text outline-none placeholder:text-muted ${
            value > QUICK_MAX ? 'border-brand' : 'border-line focus:border-brand'
          }`}
        />
        <button
          type="submit"
          disabled={!customValid}
          className="rounded-xl bg-brand px-4 text-sm font-semibold text-bg active:opacity-80 disabled:opacity-30"
        >
          {customValid && totalCents > 0
            ? `${customN}x de ${formatBRL(splitAmount(totalCents, customN)!.at(-1)!)}`
            : 'OK'}
        </button>
      </form>

      <div className="grid grid-cols-4 gap-1.5">
        {QUICK.map((n) => {
          const parts = totalCents > 0 ? splitAmount(totalCents, n) : null
          const disabled = totalCents > 0 && !parts
          const active = n === value
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onPick(n)}
              className={`flex h-14 flex-col items-center justify-center rounded-xl disabled:opacity-25 ${
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
