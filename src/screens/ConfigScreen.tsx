import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { NewCategorySheet } from '../components/NewCategorySheet'
import { RecurringSheet } from '../components/RecurringSheet'
import { onDataChange } from '../db/events'
import { listRecurringRules } from '../db/recurring'
import {
  clearLocalData,
  countPending,
  createCategory,
  listAllCategories,
  listArchivedCategories,
  listCategories,
  moveCategory,
  restoreCategory,
  updateCategory,
} from '../db/repo'
import type { Category, Kind, RecurringRule } from '../db/types'
import { formatBRL } from '../lib/money'
import { supabase } from '../lib/supabase'

const KIND_LABEL: Record<Kind, string> = { expense: 'Despesa', income: 'Receita' }
type Section = 'categories' | 'recurring'

export function ConfigScreen() {
  const [section, setSection] = useState<Section>('categories')
  const [logout, setLogout] = useState<{ pending: number } | null>(null)

  async function signOut() {
    await clearLocalData()
    await supabase.auth.signOut({ scope: 'local' })
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col">
      {/* Raro (trocar seção, sair): fica em cima */}
      <header className="flex items-center gap-2 border-b border-line px-3 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
        <div className="grid flex-1 grid-cols-2 rounded-xl bg-surface p-1" role="tablist">
          {(['categories', 'recurring'] as Section[]).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={s === section}
              onClick={() => setSection(s)}
              className={`rounded-lg py-1.5 text-sm font-semibold ${s === section ? 'bg-surface-2 text-brand' : 'text-muted'}`}
            >
              {s === 'categories' ? 'Categorias' : 'Recorrentes'}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={async () => setLogout({ pending: await countPending() })}
          className="rounded-lg px-3 py-1.5 text-sm text-muted active:bg-surface"
        >
          Sair
        </button>
      </header>

      {section === 'categories' ? <CategoriesPanel /> : <RecurringPanel />}

      {logout && (
        <div className="fixed inset-0 z-40 flex items-end justify-center" role="dialog" aria-modal="true">
          <div className="sheet-backdrop absolute inset-0 bg-black/70" onClick={() => setLogout(null)} />
          <div className="sheet-in relative w-full max-w-md rounded-t-2xl border-t border-line bg-surface px-4 pt-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
            <p className="text-base font-semibold text-text">Sair deste aparelho?</p>
            <p className={`mt-1 text-sm ${logout.pending ? 'text-warning' : 'text-muted'}`}>
              {logout.pending
                ? `Há ${logout.pending} alteração(ões) ainda não enviada(s). Elas serão perdidas.`
                : 'Seus dados continuam salvos na nuvem.'}
            </p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setLogout(null)} className="flex-1 rounded-xl py-3 text-sm text-muted active:bg-surface-2">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void signOut()}
                className="flex-1 rounded-xl bg-negative py-3 text-sm font-semibold text-bg active:opacity-80"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PlusButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-bg active:opacity-80"
    >
      <Icon name="plus" />
    </button>
  )
}

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------

function CategoriesPanel() {
  const [kind, setKind] = useState<Kind>('expense')
  const [active, setActive] = useState<Category[]>([])
  const [archived, setArchived] = useState<Category[]>([])
  const [editing, setEditing] = useState<Category | 'new' | null>(null)

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([listCategories(kind), listArchivedCategories(kind)])
    setActive(a)
    setArchived(b)
  }, [kind])

  useEffect(() => {
    void load()
    return onDataChange(() => void load())
  }, [load])

  // Lista invertida: a de baixo é a 1ª da ordem, que fica mais perto do teclado na tela Lançar.
  const shown = [...active].reverse()

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3">
        <div className="mt-auto flex flex-col gap-3 py-3">
          {archived.length > 0 && (
            <section>
              <h2 className="mb-1 px-1 text-xs text-muted">Arquivadas</h2>
              <ul className="overflow-hidden rounded-xl bg-surface">
                {archived.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 border-b border-line px-3 py-2 last:border-0">
                    <span className="text-xl opacity-50" aria-hidden>
                      {c.icon ?? '•'}
                    </span>
                    <span className="flex-1 truncate text-sm text-muted">{c.name}</span>
                    <button
                      type="button"
                      onClick={() => void restoreCategory(c.id)}
                      className="rounded-lg px-3 py-1.5 text-sm text-brand active:bg-brand-soft"
                    >
                      Restaurar
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <p className="mb-1 px-1 text-xs text-muted">As de baixo ficam mais perto do teclado na tela Lançar.</p>
            <ul className="overflow-hidden rounded-xl bg-surface">
              {shown.map((c, i) => (
                <li key={c.id} className="flex items-center border-b border-line last:border-0">
                  <button
                    type="button"
                    onClick={() => setEditing(c)}
                    className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left active:bg-surface-2"
                  >
                    <span className="text-xl" aria-hidden>
                      {c.icon ?? '•'}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-text">{c.name}</span>
                      {c.monthly_budget_cents && (
                        <span className="block text-xs text-muted tabular-nums">
                          Orçamento {formatBRL(c.monthly_budget_cents)}
                        </span>
                      )}
                    </span>
                  </button>
                  {/* ↑ na lista = mais longe do teclado = depois na ordem */}
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => void moveCategory(c.id, 1)}
                    aria-label={`Subir ${c.name}`}
                    className="p-3 text-muted active:bg-surface-2 disabled:opacity-20"
                  >
                    <Icon name="chevronLeft" className="h-4 w-4 rotate-90" />
                  </button>
                  <button
                    type="button"
                    disabled={i === shown.length - 1}
                    onClick={() => void moveCategory(c.id, -1)}
                    aria-label={`Descer ${c.name}`}
                    className="p-3 text-muted active:bg-surface-2 disabled:opacity-20"
                  >
                    <Icon name="chevronRight" className="h-4 w-4 rotate-90" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {/* Ações frequentes embaixo */}
      <div className="flex items-center gap-2 border-t border-line px-3 py-2">
        <div className="grid flex-1 grid-cols-2 rounded-xl bg-surface p-1" role="tablist">
          {(['expense', 'income'] as Kind[]).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={k === kind}
              onClick={() => setKind(k)}
              className={`rounded-lg py-2 text-sm font-semibold ${
                k === kind ? `bg-surface-2 ${k === 'expense' ? 'text-negative' : 'text-positive'}` : 'text-muted'
              }`}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <PlusButton label="Nova categoria" onClick={() => setEditing('new')} />
      </div>

      {editing && (
        <NewCategorySheet
          key={editing === 'new' ? 'new' : editing.id}
          kind={kind}
          initial={editing === 'new' ? undefined : editing}
          onSave={async ({ name, icon, monthly_budget_cents }) => {
            if (editing === 'new') {
              const c = await createCategory({ kind, name, icon })
              if (monthly_budget_cents) await updateCategory(c.id, { monthly_budget_cents })
            } else await updateCategory(editing.id, { name, icon, monthly_budget_cents })
            setEditing(null)
          }}
          onArchive={
            editing === 'new'
              ? undefined
              : async () => {
                  await updateCategory(editing.id, { archived: true })
                  setEditing(null)
                }
          }
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Recorrentes
// ---------------------------------------------------------------------------

function RecurringPanel() {
  const [rules, setRules] = useState<RecurringRule[]>([])
  const [categories, setCategories] = useState<Map<string, Category>>(new Map())
  const [editing, setEditing] = useState<RecurringRule | 'new' | null>(null)

  const load = useCallback(async () => {
    const [r, c] = await Promise.all([listRecurringRules(), listAllCategories()])
    setRules(r)
    setCategories(new Map(c.map((x) => [x.id, x])))
  }, [])

  useEffect(() => {
    void load()
    return onDataChange(() => void load())
  }, [load])

  const monthly = rules
    .filter((r) => !r.end_month)
    .reduce((sum, r) => sum + (r.kind === 'income' ? r.amount_cents : -r.amount_cents), 0)

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3">
        {rules.length === 0 ? (
          <div className="m-auto max-w-64 text-center text-sm text-muted">
            Cadastre aluguel, assinaturas e salário. Eles entram como previstos nos próximos 12 meses.
          </div>
        ) : (
          <div className="mt-auto flex flex-col gap-2 py-3">
            <ul className="overflow-hidden rounded-xl bg-surface">
              {rules.map((r) => {
                const c = categories.get(r.category_id)
                const ended = !!r.end_month
                return (
                  <li key={r.id} className="border-b border-line last:border-0">
                    <button
                      type="button"
                      onClick={() => setEditing(r)}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-surface-2 ${ended ? 'opacity-50' : ''}`}
                    >
                      <span className="text-xl" aria-hidden>
                        {c?.icon ?? '•'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-text">{r.note ?? c?.name ?? 'Recorrente'}</span>
                        <span className="block truncate text-xs text-muted">
                          {ended ? 'Encerrada' : `Todo dia ${r.day_of_month}`}
                          {r.note && c ? ` · ${c.name}` : ''}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 text-sm font-medium tabular-nums ${r.kind === 'expense' ? 'text-negative' : 'text-positive'}`}
                      >
                        {r.kind === 'expense' ? '-' : '+'}
                        {formatBRL(r.amount_cents)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <p className="px-1 text-right text-xs text-muted tabular-nums">
              Saldo fixo por mês:{' '}
              <span className={monthly < 0 ? 'text-negative' : 'text-positive'}>{formatBRL(monthly)}</span>
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-line px-3 py-2">
        <span className="flex-1 text-xs text-muted">Nova conta fixa</span>
        <PlusButton label="Nova recorrente" onClick={() => setEditing('new')} />
      </div>

      {editing && (
        <RecurringSheet
          key={editing === 'new' ? 'new' : editing.id}
          rule={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
