import Dexie, { type EntityTable } from 'dexie'
import type { Category, MetaEntry, RecurringRule, Transaction } from './types'

export class MyMoneyDB extends Dexie {
  categories!: EntityTable<Category, 'id'>
  recurring_rules!: EntityTable<RecurringRule, 'id'>
  transactions!: EntityTable<Transaction, 'id'>
  meta!: EntityTable<MetaEntry, 'key'>

  constructor(name = 'my-money') {
    super(name)
    this.version(1).stores({
      categories: 'id, kind, pending',
      recurring_rules: 'id, pending',
      transactions: 'id, occurred_on, status, installment_group_id, pending',
      meta: 'key',
    })
    // v2: índice para achar os lançamentos de uma regra recorrente.
    this.version(2).stores({
      transactions: 'id, occurred_on, status, installment_group_id, recurring_rule_id, pending',
    })
  }
}

export const db = new MyMoneyDB()
