import { useState } from 'react'
import { supabase } from '../lib/supabase'

function friendlyError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (m.includes('email not confirmed')) return 'Usuário não confirmado no Supabase (marque "Auto Confirm User").'
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas. Aguarde alguns minutos.'
  if (m.includes('fetch') || m.includes('network')) return 'Sem conexão. O primeiro login precisa de internet.'
  return message
}

/**
 * Login com e-mail e senha. O usuário é criado direto no painel do Supabase
 * (cadastro pelo app desligado), então aqui só existe "Entrar".
 */
export function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const valid = /^\S+@\S+\.\S+$/.test(email.trim()) && password.length > 0

  async function signIn() {
    if (!valid || busy) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setError(friendlyError(error.message))
    // Sucesso: o App percebe a sessão nova e troca de tela.
  }

  const input =
    'w-full rounded-xl border border-line bg-surface-2 px-4 py-3.5 text-base text-text outline-none placeholder:text-muted focus:border-brand'

  return (
    // Alcance do polegar: tudo que se toca fica na metade de baixo.
    <div className="mx-auto flex h-full w-full max-w-md flex-col px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-brand">My Money</h1>
        <p className="text-sm text-muted">Entre uma vez neste aparelho</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void signIn()
        }}
        className="flex flex-col gap-3"
      >
        {error && <p className="rounded-xl bg-surface px-4 py-3 text-sm text-warning">{error}</p>}
        <input
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail"
          aria-label="E-mail"
          className={input}
        />
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Senha"
          aria-label="Senha"
          className={input}
        />
        <button
          type="submit"
          disabled={!valid || busy}
          className="w-full rounded-xl bg-brand py-3.5 text-base font-semibold text-bg active:opacity-80 disabled:opacity-30"
        >
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
