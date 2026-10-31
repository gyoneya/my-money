import { addMonthsISO, formatMonthLabel, monthKey, todayISO } from '../lib/dates'
import { Icon } from './Icon'

export const shiftMonth = (month: string, delta: number) => monthKey(addMonthsISO(`${month}-01`, delta))

/** Seletor de mês na base da tela (alcance do polegar). Tocar no nome volta ao mês atual. */
export function MonthBar({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const current = monthKey(todayISO())
  return (
    <div className="flex items-center gap-2 border-t border-line px-3 py-2">
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, -1))}
        aria-label="Mês anterior"
        className="rounded-xl p-3 text-muted active:bg-surface"
      >
        <Icon name="chevronLeft" />
      </button>
      <button
        type="button"
        onClick={() => onChange(current)}
        className={`flex-1 rounded-xl py-2 text-center text-sm font-semibold first-letter:uppercase ${
          month === current ? 'text-text' : 'text-brand'
        }`}
      >
        {formatMonthLabel(month)}
      </button>
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, 1))}
        aria-label="Próximo mês"
        className="rounded-xl p-3 text-muted active:bg-surface"
      >
        <Icon name="chevronRight" />
      </button>
    </div>
  )
}
