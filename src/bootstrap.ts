import { db } from './db/db'
import { topUpRecurring } from './db/recurring'
import { ensureLocalOwner, promotePlanned, seedCategoriesIfEmpty } from './db/repo'
import { supabase } from './lib/supabase'
import { syncNow } from './sync/manager'

/**
 * Roda ao abrir o app (já logado):
 * 1. dados locais pertencem a este usuário (primeiro login limpa o aparelho);
 * 2. aparelho vazio: baixa do servidor; se o servidor também estiver vazio, cria as categorias iniciais;
 * 3. recorrentes completam o horizonte de 12 meses;
 * 4. previstos vencidos viram realizados.
 */
export async function bootstrap(userId: string): Promise<void> {
  await ensureLocalOwner(userId)

  if ((await db.categories.count()) === 0) {
    const { count, error } = await supabase.from('categories').select('id', { count: 'exact', head: true })
    if (!error && count === 0) await seedCategoriesIfEmpty()
    else if (!error) await syncNow()
  }

  await topUpRecurring()
  await promotePlanned()
}
