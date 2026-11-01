// Gráficos da Análise (Recharts). Ficam no pedaço do app que só carrega na aba Análise.
import { useState, type ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Transaction } from '../db/types'
import { commitments, evolution } from '../lib/analysis'
import { formatMonthLabel, formatMonthShort } from '../lib/dates'
import { formatBRL, formatCompactBRL } from '../lib/money'

const AXIS = { fill: 'var(--color-muted)', fontSize: 11 }
/** Eixo sem "R$" (cabe numa linha): `2,6 mil`. */
const axisMoney = (reais: number) => formatCompactBRL(reais * 100).replace('R$ ', '')
const Y_AXIS = { tick: AXIS, tickLine: false, axisLine: false, width: 48, tickCount: 3, tickFormatter: axisMoney } as const
const GRID = 'var(--color-line)'

function TooltipBox({ title, lines }: { title: string; lines: [label: string, value: number, swatch?: string][] }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-text first-letter:uppercase">{title}</p>
      {lines.map(([label, value, swatch]) => (
        <p key={label} className="flex items-center gap-2 text-muted">
          {swatch && <span className="h-2 w-2 rounded-sm" style={{ background: swatch }} />}
          <span className="flex-1">{label}</span>
          <span className="text-text tabular-nums">{formatBRL(value)}</span>
        </p>
      ))}
    </div>
  )
}

/** Alternativa em lista (acessível e boa para conferir valores exatos). */
function ValuesToggle({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs text-brand">
        {open ? 'Ocultar valores' : 'Ver valores'}
      </button>
      {open && <div className="mt-2 flex flex-col gap-1 text-xs tabular-nums">{children}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 4. Compromissos futuros
// ---------------------------------------------------------------------------

export function CommitmentsChart({ rows, fromMonth }: { rows: Transaction[]; fromMonth: string }) {
  // Eixo em reais (marcas redondas: 0, 500, 1.000...); tooltip usa os centavos.
  const data = commitments(rows, fromMonth, 12).map((c) => ({ ...c, label: formatMonthShort(c.month), totalR: c.total / 100 }))
  const total = data.reduce((s, c) => s + c.total, 0)

  if (total === 0) return <p className="text-sm text-muted">Nenhuma parcela ou conta fixa prevista.</p>

  return (
    <>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barCategoryGap={3}>
            <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="2 4" />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval={0} />
            <YAxis {...Y_AXIS} />
            <Tooltip
              cursor={{ fill: 'var(--color-brand-soft)' }}
              content={({ active, payload }) => {
                const c = active && payload?.[0]?.payload
                if (!c) return null
                return (
                  <TooltipBox
                    title={formatMonthLabel(c.month)}
                    lines={[
                      ['Parcelas', c.installments],
                      ['Contas fixas', c.recurring],
                      ...(c.other ? [['Outros', c.other] as [string, number]] : []),
                      ['Total', c.total],
                    ]}
                  />
                )
              }}
            />
            <Bar dataKey="totalR" fill="var(--color-brand)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-muted">Despesas previstas (parcelas + contas fixas) por mês. Toque numa barra.</p>
      <ValuesToggle>
        {data.map((c) => (
          <p key={c.month} className="flex justify-between">
            <span className="text-muted first-letter:uppercase">{formatMonthLabel(c.month)}</span>
            <span className="text-text">{formatBRL(c.total)}</span>
          </p>
        ))}
      </ValuesToggle>
    </>
  )
}

// ---------------------------------------------------------------------------
// 6. Evolução
// ---------------------------------------------------------------------------

/**
 * Receitas sobem, despesas descem (um eixo só). A posição identifica a série;
 * verde/vermelho pastel só reforça (não dá para distinguir por cor no daltonismo).
 */
export function EvolutionChart({ rows, endMonth }: { rows: Transaction[]; endMonth: string }) {
  const data = evolution(rows, endMonth, 12).map((p) => ({
    ...p,
    label: formatMonthShort(p.month),
    incomeR: p.income / 100,
    expenseNegR: -p.expense / 100,
  }))

  if (data.every((p) => p.income === 0 && p.expense === 0)) {
    return <p className="text-sm text-muted">Ainda não há meses com lançamentos.</p>
  }

  return (
    <>
      <div className="mb-2 flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-positive" /> Receitas (para cima)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-negative" /> Despesas (para baixo)
        </span>
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} stackOffset="sign" margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barCategoryGap={3}>
            <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="2 4" />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval={0} />
            <YAxis {...Y_AXIS} />
            <ReferenceLine y={0} stroke="var(--color-muted)" />
            <Tooltip
              cursor={{ fill: 'var(--color-brand-soft)' }}
              content={({ active, payload }) => {
                const p = active && payload?.[0]?.payload
                if (!p) return null
                return (
                  <TooltipBox
                    title={formatMonthLabel(p.month)}
                    lines={[
                      ['Receitas', p.income, 'var(--color-positive)'],
                      ['Despesas', -p.expense, 'var(--color-negative)'],
                      ['Saldo', p.income - p.expense],
                    ]}
                  />
                )
              }}
            />
            <Bar dataKey="incomeR" stackId="m" fill="var(--color-positive)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenseNegR" stackId="m" fill="var(--color-negative)" radius={[0, 0, 4, 4]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ValuesToggle>
        {data.map((p) => (
          <p key={p.month} className="flex justify-between gap-2">
            <span className="flex-1 text-muted first-letter:uppercase">{formatMonthLabel(p.month)}</span>
            <span className="text-positive">+{formatBRL(p.income)}</span>
            <span className="w-24 text-right text-negative">-{formatBRL(p.expense)}</span>
          </p>
        ))}
      </ValuesToggle>
    </>
  )
}
