import type { Category } from '../db/types'
import { Icon } from './Icon'

const COLS = 4
const TILE = 'flex h-[4.25rem] flex-col items-center justify-center gap-1 rounded-xl px-1'

/**
 * Preenche de baixo para cima (alcance do polegar): a 1ª categoria fica na linha
 * de baixo, as novas entram em cima, e o "+" fica sempre por último, no topo.
 */
export function CategoryGrid({
  categories,
  onPick,
  onAdd,
}: {
  categories: Category[]
  onPick: (category: Category) => void
  onAdd: () => void
}) {
  const items: (Category | 'add')[] = [...categories, 'add']
  const rows: (Category | 'add' | null)[][] = []
  for (let i = 0; i < items.length; i += COLS) rows.push(items.slice(i, i + COLS))
  // Completa a linha do topo com vazios para as de baixo ficarem cheias.
  const top = rows[rows.length - 1]
  while (top.length < COLS) top.push(null)

  return (
    <div className="grid grid-cols-4 gap-1.5">
      {rows.reverse().flat().map((item, i) =>
        item === null ? (
          <div key={`empty-${i}`} aria-hidden />
        ) : item === 'add' ? (
          <button
            key="add"
            type="button"
            onClick={onAdd}
            aria-label="Nova categoria"
            className={`${TILE} border border-dashed border-line text-muted active:bg-surface`}
          >
            <Icon name="plus" className="h-6 w-6" />
          </button>
        ) : (
          <button key={item.id} type="button" onClick={() => onPick(item)} className={`${TILE} bg-surface active:bg-surface-2`}>
            <span className="text-2xl leading-none" aria-hidden>
              {item.icon ?? '•'}
            </span>
            <span className="line-clamp-2 w-full text-center text-[0.68rem] leading-tight break-words text-muted">
              {item.name}
            </span>
          </button>
        ),
      )}
    </div>
  )
}
