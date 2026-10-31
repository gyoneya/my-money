import { useState } from 'react'
import { Sheet } from './Sheet'

export function NoteSheet({
  value,
  onSave,
  onClose,
}: {
  value: string
  onSave: (note: string) => void
  onClose: () => void
}) {
  const [text, setText] = useState(value)

  return (
    <Sheet title="Nota" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSave(text.trim())
        }}
        className="flex gap-2"
      >
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={200}
          placeholder="Ex.: almoço com a equipe"
          enterKeyHint="done"
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-4 py-3 text-base text-text outline-none placeholder:text-muted focus:border-brand"
        />
        <button type="submit" className="rounded-xl bg-brand px-4 text-sm font-semibold text-bg active:opacity-80">
          OK
        </button>
      </form>
      {value && (
        <button type="button" onClick={() => onSave('')} className="mt-3 text-sm text-negative">
          Remover nota
        </button>
      )}
    </Sheet>
  )
}
