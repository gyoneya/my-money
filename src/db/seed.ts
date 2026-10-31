import type { Kind } from './types'

export const SEED_CATEGORIES: Record<Kind, [name: string, icon: string][]> = {
  expense: [
    ['Mercado', '🛒'],
    ['Alimentação fora', '🍽️'],
    ['Transporte', '🚗'],
    ['Moradia', '🏠'],
    ['Contas', '💡'],
    ['Saúde', '💊'],
    ['Lazer', '🎉'],
    ['Compras', '🛍️'],
    ['Pets', '🐾'],
    ['Assinaturas', '📺'],
    ['Educação', '📚'],
    ['Outros', '📦'],
  ],
  income: [
    ['Salário', '💼'],
    ['Extra', '✨'],
    ['Vendas', '🏷️'],
    ['Rendimentos', '📈'],
    ['Outros', '📦'],
  ],
}
