import { addDaysISO, formatDateBR, relativeDayLabel } from '../lib/dates'
import { Sheet } from './Sheet'

export function DateSheet({
  value,
  today,
  onPick,
  onClose,
}: {
  value: string
  today: string
  onPick: (iso: string) => void
  onClose: () => void
}) {
  // Alcance do polegar: "Hoje" embaixo à direita; calendário (menos usado) em cima.
  const quick = [-2, -1, 0].map((d) => addDaysISO(today, d))

  return (
    <Sheet title="Data" onClose={onClose}>
      <label className="mb-2 flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-4 py-3">
        <span className="text-sm text-muted">Outra data</span>
        <input
          type="date"
          value={value}
          onChange={(e) => e.target.value && onPick(e.target.value)}
          className="bg-transparent text-right text-sm text-text [color-scheme:dark]"
        />
      </label>
      <div className="grid grid-cols-3 gap-2">
        {quick.map((iso) => (
          <button
            key={iso}
            type="button"
            onClick={() => onPick(iso)}
            className={`rounded-xl py-3 text-sm font-medium ${
              iso === value ? 'bg-brand-soft text-brand' : 'bg-surface-2 text-text active:bg-line'
            }`}
          >
            {relativeDayLabel(iso, today)}
            <span className="block text-xs font-normal text-muted">{formatDateBR(iso).slice(0, 5)}</span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}
