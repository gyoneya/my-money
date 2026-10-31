import { db } from './db/db'
import { ensureLocalOwner, promotePlanned, seedCategoriesIfEmpty } from './db/repo'
import { supabase } from './lib/supabase'

/**
 * Roda ao abrir o app (já logado):
 * 1. dados locais pertencem a este usuário (primeiro login limpa o aparelho);
 * 2. categorias iniciais só se o servidor ainda não tiver nenhuma;
 * 3. previstos vencidos viram realizados.
 */
export async function bootstrap(userId: string): Promise<void> {
  await ensureLocalOwner(userId)

  if ((await db.categories.count()) === 0) {
    const { count, error } = await supabase.from('categories').select('id', { count: 'exact', head: true })
    if (!error && count === 0) await seedCategoriesIfEmpty()
  }

  await promotePlanned()
}
