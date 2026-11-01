import { useEffect, useRef, useState } from 'react'
import { CategoryGrid } from '../components/CategoryGrid'
import { Sheet } from '../components/Sheet'
import { addTransactions, buildInstallmentTransactions, listCategories } from '../db/repo'
import type { Category, Transaction } from '../db/types'
import { simulatePurchase } from '../lib/analysis'
import { formatMonthLabel, formatMonthShort, monthKey, relativeDayLabel, todayISO } from '../lib/dates'
import { MAX_INSTALLMENTS } from '../lib/installments'
import { formatBRL, parseBRL } from '../lib/money'

const QUICK = [1, 2, 3, 6, 10, 12]

/** 5. Simulador de compra: mostra o efeito no "Disponível" sem salvar; pode lançar a compra. */
export function SimulatorCard({ rows }: { rows: Transaction[] }) {
  const today = todayISO()
  const [amount, setAmount] = useState('')
  const [n, setN] = useState(1)
  const [date, setDate] = useState(today)
  const [launching, setLaunching] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  const cents = amount.trim() ? parseBRL(amount) : null
  const sim = cents ? simulatePurchase(rows, { totalCents: cents, installments: n, date }) : null
  const [first, ...next] = sim ?? []
  const negatives = (sim ?? []).filter((m) => m.after < 0).length

  const input =
    'w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-base text-text outline-none placeholder:text-muted focus:border-brand'

  return (
    <section className="rounded-2xl bg-surface p-4">
      <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">Simulador de compra</h2>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value)
            setDone(null)
          }}
          onBlur={() => cents && setAmount(formatBRL(cents))}
          placeholder="Valor total (R$)"
          aria-label="Valor total da compra"
          className={`${input} ${amount.trim() && !cents ? 'border-warning' : ''}`}
        />
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          aria-label="Data da compra"
          title={relativeDayLabel(date, today)}
          className="w-36 rounded-xl border border-line bg-surface-2 px-2 text-sm text-text outline-none [color-scheme:dark] focus:border-brand"
        />
      </div>

      {/* Parcelas: atalhos + campo livre */}
      <div className="mt-2 flex items-center gap-1.5">
        {QUICK.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setN(q)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${
              q === n ? 'bg-brand-soft text-brand ring-1 ring-brand' : 'bg-surface-2 text-text active:bg-line'
            }`}
          >
            {q === 1 ? '1x' : `${q}x`}
          </button>
        ))}
        <input
          inputMode="numeric"
          value={QUICK.includes(n) ? '' : String(n)}
          onChange={(e) => {
            const v = Number(e.target.value.replace(/\D/g, '').slice(0, 2))
            if (v >= 1 && v <= MAX_INSTALLMENTS) setN(v)
          }}
          placeholder="nº"
          aria-label="Outro número de parcelas"
          className={`w-12 rounded-lg border bg-surface-2 py-2 text-center text-sm text-text outline-none placeholder:text-muted ${
            QUICK.includes(n) ? 'border-line' : 'border-brand'
          }`}
        />
      </div>

      {!cents ? (
        <p className="mt-3 text-sm text-muted">Digite um valor para ver o efeito no seu mês, sem salvar nada.</p>
      ) : !sim ? (
        <p className="mt-3 text-sm text-warning">Valor pequeno demais para {n} parcelas.</p>
      ) : (
        <>
          {/* Mês da compra em destaque */}
          <div className="mt-4 rounded-xl bg-surface-2 p-3">
            <p className="text-xs text-muted first-letter:uppercase">
              {monthKey(date) === monthKey(today) ? 'Este mês' : formatMonthLabel(first.month)} ·{' '}
              {n === 1 ? 'à vista' : `1ª parcela ${formatBRL(first.installment)}`}
            </p>
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2 tabular-nums">
              <span className={`text-sm ${first.before < 0 ? 'text-negative' : 'text-muted'}`}>{formatBRL(first.before)}</span>
              <span className="text-muted">→</span>
              <span className={`text-2xl font-semibold ${first.after < 0 ? 'text-negative' : 'text-positive'}`}>
                {formatBRL(first.after)}
              </span>
            </p>
          </div>

          {next.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 text-sm tabular-nums">
              {next.map((m) => (
                <li key={m.month} className="flex items-center gap-2">
                  <span className="flex-1 text-muted first-letter:uppercase">{formatMonthShort(m.month, true)}</span>
                  <span className={m.before < 0 ? 'text-negative' : 'text-muted'}>{formatBRL(m.before)}</span>
                  <span className="text-muted">→</span>
                  <span className={`w-28 text-right font-medium ${m.after < 0 ? 'text-negative' : 'text-text'}`}>
                    {formatBRL(m.after)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {negatives > 0 && (
            <p className="mt-3 rounded-xl bg-negative/10 px-3 py-2 text-sm text-negative">
              ⚠ {negatives === 1 ? '1 mês fica' : `${negatives} meses ficam`} no vermelho com esta compra.
            </p>
          )}

          <button
            type="button"
            onClick={() => setLaunching(true)}
            className="mt-3 w-full rounded-xl bg-brand py-3 text-sm font-semibold text-bg active:opacity-80"
          >
            Lançar esta compra
          </button>
        </>
      )}

      {done && <p className="mt-3 text-sm text-positive">✓ {done}</p>}

      {launching && cents && (
        <LaunchSheet
          onClose={() => setLaunching(false)}
          onPick={async (category, note) => {
            await addTransactions(
              buildInstallmentTransactions(
                { kind: 'expense', amount_cents: cents, category_id: category.id, occurred_on: date, note },
                n,
                today,
              ),
            )
            navigator.vibrate?.(30)
            setLaunching(false)
            setDone(`${formatBRL(cents)}${n > 1 ? ` em ${n}x` : ''} lançado em ${category.name}`)
            setAmount('')
            setN(1)
            setDate(today)
          }}
        />
      )}
    </section>
  )
}

/** Descrição e categoria (ambas obrigatórias) para lançar a compra simulada. */
function LaunchSheet({
  onPick,
  onClose,
}: {
  onPick: (category: Category, note: string) => void
  onClose: () => void
}) {
  const [categories, setCategories] = useState<Category[]>([])
  const [note, setNote] = useState('')
  const [noteMissing, setNoteMissing] = useState(false)
  const noteRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    void listCategories('expense').then(setCategories)
  }, [])

  return (
    <Sheet title="Descreva e escolha a categoria" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <input
          ref={noteRef}
          value={note}
          onChange={(e) => {
            setNote(e.target.value)
            setNoteMissing(false)
          }}
          maxLength={200}
          placeholder={noteMissing ? 'Descrição obrigatória' : 'Descrição'}
          aria-label="Descrição"
          aria-required="true"
          className={`rounded-xl border bg-surface-2 px-4 py-3 text-base text-text outline-none ${
            noteMissing ? 'border-warning placeholder:text-warning' : 'border-line placeholder:text-muted focus:border-brand'
          }`}
        />
        <CategoryGrid
          categories={categories}
          onPick={(c) => {
            if (note.trim()) return onPick(c, note.trim())
            setNoteMissing(true)
            noteRef.current?.focus()
          }}
        />
      </div>
    </Sheet>
  )
}
