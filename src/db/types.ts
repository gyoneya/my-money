// Espelho local das tabelas do Supabase (sem user_id: o servidor preenche com auth.uid()).

export type Kind = 'expense' | 'income'
export type Status = 'done' | 'planned'

/** 1 = alterado localmente e ainda não enviado ao servidor. (0/1 porque o IndexedDB não indexa boolean.) */
export type PendingFlag = 0 | 1

export interface Category {
  id: string
  kind: Kind
  name: string
  icon: string | null
  sort_order: number
  monthly_budget_cents: number | null
  archived: boolean
  updated_at: string
  pending: PendingFlag
}

export interface RecurringRule {
  id: string
  kind: Kind
  amount_cents: number
  category_id: string
  day_of_month: number
  start_month: string
  end_month: string | null
  note: string | null
  updated_at: string
  deleted_at: string | null
  pending: PendingFlag
}

export interface Transaction {
  id: string
  kind: Kind
  status: Status
  amount_cents: number
  category_id: string
  occurred_on: string
  note: string | null
  installment_group_id: string | null
  installment_number: number | null
  installment_total: number | null
  recurring_rule_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  pending: PendingFlag
}

export interface MetaEntry {
  key: string
  value: string
}
