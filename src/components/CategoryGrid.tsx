import type { Category } from '../db/types'
import { Icon } from './Icon'

const TILE = 'flex h-[4.25rem] flex-col items-center justify-center gap-1 rounded-xl px-1'

export function CategoryGrid({
  categories,
  onPick,
  onAdd,
}: {
  categories: Category[]
  onPick: (category: Category) => void
  onAdd: () => void
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {categories.map((c) => (
        <button key={c.id} type="button" onClick={() => onPick(c)} className={`${TILE} bg-surface active:bg-surface-2`}>
          <span className="text-2xl leading-none" aria-hidden>
            {c.icon ?? '•'}
          </span>
          <span className="line-clamp-2 w-full text-center text-[0.68rem] leading-tight break-words text-muted">
            {c.name}
          </span>
        </button>
      ))}
      <button
        type="button"
        onClick={onAdd}
        aria-label="Nova categoria"
        className={`${TILE} border border-dashed border-line text-muted active:bg-surface`}
      >
        <Icon name="plus" className="h-6 w-6" />
      </button>
    </div>
  )
}
