import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined

if (!url || !key) {
  throw new Error('Faltam VITE_SUPABASE_URL / VITE_SUPABASE_KEY no .env (veja .env.example)')
}

// Sessão persistente no aparelho: login uma vez por dispositivo; funciona offline.
export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})
