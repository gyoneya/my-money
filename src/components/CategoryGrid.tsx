import type { Category } from '../db/types'

export function CategoryGrid({
  categories,
  onPick,
}: {
  categories: Category[]
  onPick: (category: Category) => void
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onPick(c)}
          className="flex h-[4.25rem] flex-col items-center justify-center gap-1 rounded-xl bg-surface px-1 active:bg-surface-2"
        >
          <span className="text-2xl leading-none" aria-hidden>
            {c.icon ?? '•'}
          </span>
          <span className="line-clamp-2 w-full text-center text-[0.68rem] leading-tight break-words text-muted">
            {c.name}
          </span>
        </button>
      ))}
    </div>
  )
}
