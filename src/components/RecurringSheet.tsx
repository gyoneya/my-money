import { useEffect, useRef, useState } from 'react'
import { createRecurringRule, endRecurringRule, updateRecurringRule } from '../db/recurring'
import { listCategories } from '../db/repo'
import type { Category, Kind, RecurringRule } from '../db/types'
import { formatBRL, pressKey } from '../lib/money'
import { CategoryGrid } from './CategoryGrid'
import { Icon } from './Icon'
import { Keypad } from './Keypad'
import { Sheet } from './Sheet'

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

/** Criar/editar/encerrar conta recorrente. */
export function RecurringSheet({ rule, onClose }: { rule: RecurringRule | null; onClose: () => void }) {
  const [kind, setKind] = useState<Kind>(rule?.kind ?? 'expense')
  const [cents, setCents] = useState(rule?.amount_cents ?? 0)
  const [day, setDay] = useState(rule?.day_of_month ?? 5)
  const [categoryId, setCategoryId] = useState<string | null>(rule?.category_id ?? null)
  const [note, setNote] = useState(rule?.note ?? '')
  const [categories, setCategories] = useState<Category[]>([])
  const [picker, setPicker] = useState<'category' | 'day' | null>(null)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [shake, setShake] = useState(0)
  const touched = useRef(false)
  const noteRef = useRef<HTMLInputElement>(null)
  const [noteMissing, setNoteMissing] = useState(false)
  const ended = !!rule?.end_month

  useEffect(() => {
    void listCategories(kind).then(setCategories)
  }, [kind])

  const category = categories.find((c) => c.id === categoryId)
  const valid = cents > 0 && !!category

  async function save() {
    if (!valid) {
      setShake((n) => n + 1)
      if (cents > 0 && !category) setPicker('category')
      return
    }
    if (!note.trim()) {
      setNoteMissing(true)
      noteRef.current?.focus()
      return
    }
    const input = { kind, amount_cents: cents, category_id: category.id, day_of_month: day, note: note.trim() }
    if (rule) await updateRecurringRule(rule.id, input)
    else await createRecurringRule(input)
    onClose()
  }

  async function end() {
    if (!confirmEnd) return setConfirmEnd(true)
    await endRecurringRule(rule!.id)
    onClose()
  }

  const color = kind === 'expense' ? 'text-negative' : 'text-positive'
  const chip = 'flex min-w-0 items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-2 text-sm text-text active:bg-line'

  return (
    <>
      <Sheet title={rule ? (ended ? 'Recorrente encerrada' : 'Editar recorrente') : 'Nova recorrente'} onClose={onClose}>
        <div className="flex flex-col gap-3">
          {!rule && (
            <div className="grid grid-cols-2 rounded-xl bg-bg p-1" role="tablist">
              {(['expense', 'income'] as Kind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={k === kind}
                  onClick={() => {
                    setKind(k)
                    setCategoryId(null)
                  }}
                  className={`rounded-lg py-2 text-sm font-semibold ${
                    k === kind ? `bg-surface-2 ${k === 'expense' ? 'text-negative' : 'text-positive'}` : 'text-muted'
                  }`}
                >
                  {k === 'expense' ? 'Despesa' : 'Receita'}
                </button>
              ))}
            </div>
          )}

          <div key={shake} className={`text-center ${shake ? 'shake' : ''}`}>
            <p className="text-xs text-muted">Valor por mês</p>
            <p className={`text-4xl font-semibold tracking-tight tabular-nums ${cents ? color : 'text-muted'}`}>{formatBRL(cents)}</p>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => setPicker('category')} className={`${chip} flex-1`}>
              <span aria-hidden>{category?.icon ?? '•'}</span>
              <span className={`truncate ${category ? '' : 'text-muted'}`}>{category?.name ?? 'Categoria'}</span>
            </button>
            <button type="button" onClick={() => setPicker('day')} className={chip}>
              <Icon name="calendar" className="h-4 w-4 shrink-0" />
              Todo dia {day}
            </button>
          </div>

          <input
            ref={noteRef}
            value={note}
            onChange={(e) => {
              setNote(e.target.value)
              setNoteMissing(false)
            }}
            maxLength={200}
            placeholder={noteMissing ? 'Descrição obrigatória' : 'Descrição (ex.: Aluguel, Netflix, Salário)'}
            aria-label="Descrição"
            aria-required="true"
            className={`rounded-xl border bg-surface-2 px-4 py-2.5 text-base text-text outline-none ${
              noteMissing ? 'border-warning placeholder:text-warning' : 'border-line placeholder:text-muted focus:border-brand'
            }`}
          />

          <Keypad
            onKey={(k) => {
              // Primeira tecla substitui o valor atual em vez de acrescentar dígitos a ele.
              const first = !touched.current
              touched.current = true
              setCents((c) => (!first ? pressKey(c, k) : k === 'back' ? 0 : pressKey(0, k)))
            }}
          />

          <div className="flex gap-2">
            {rule && !ended && (
              <button
                type="button"
                onClick={end}
                className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                  confirmEnd ? 'bg-warning text-bg' : 'text-warning active:bg-surface-2'
                }`}
              >
                {confirmEnd ? 'Encerrar?' : 'Encerrar'}
              </button>
            )}
            <button
              type="button"
              onClick={save}
              className="flex-1 rounded-xl bg-brand py-3 text-sm font-semibold text-bg active:opacity-80"
            >
              {rule ? 'Salvar' : 'Criar'}
            </button>
          </div>
          <p className="-mt-1 text-xs text-muted">
            {rule
              ? 'Mudanças valem para os próximos meses. O que já passou não muda.'
              : 'Gera os próximos 12 meses como previstos. Se o dia já passou neste mês, começa no próximo.'}
          </p>
        </div>
      </Sheet>

      {picker === 'category' && (
        <Sheet title="Categoria" onClose={() => setPicker(null)}>
          <CategoryGrid
            categories={categories}
            selectedId={categoryId ?? undefined}
            onPick={(c) => {
              setCategoryId(c.id)
              setPicker(null)
            }}
          />
        </Sheet>
      )}
      {picker === 'day' && (
        <Sheet title="Dia do mês" onClose={() => setPicker(null)}>
          <div className="grid grid-cols-7 gap-1.5">
            {DAYS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDay(d)
                  setPicker(null)
                }}
                className={`aspect-square rounded-lg text-sm font-medium ${
                  d === day ? 'bg-brand-soft text-brand ring-1 ring-brand' : 'bg-surface-2 text-text active:bg-line'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">Em meses mais curtos, dias 29–31 caem no último dia.</p>
        </Sheet>
      )}
    </>
  )
}
