import { useState } from 'react'
import { supabase } from '../lib/supabase'

type Step = 'email' | 'code'

function friendlyError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('rate limit') || m.includes('security purposes')) return 'Muitas tentativas. Aguarde alguns minutos.'
  if (m.includes('expired') || m.includes('invalid')) return 'Código inválido ou expirado.'
  if (m.includes('signups not allowed')) return 'Este e-mail não tem acesso.'
  if (m.includes('fetch') || m.includes('network')) return 'Sem conexão. O primeiro login precisa de internet.'
  return message
}

/** Login por código de 6 dígitos enviado por e-mail (sem magic link: no iOS ele abre fora do app). */
export function LoginScreen() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const emailValid = /^\S+@\S+\.\S+$/.test(email.trim())
  const codeValid = /^\d{6,8}$/.test(code)

  async function sendCode() {
    if (!emailValid || busy) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } })
    setBusy(false)
    if (error) return setError(friendlyError(error.message))
    setCode('')
    setStep('code')
  }

  async function verify() {
    if (!codeValid || busy) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: 'email' })
    setBusy(false)
    if (error) setError(friendlyError(error.message))
    // Sucesso: o App percebe a sessão nova e troca de tela.
  }

  const input =
    'w-full rounded-xl border border-line bg-surface-2 px-4 py-3.5 text-base text-text outline-none placeholder:text-muted focus:border-brand'
  const primary = 'w-full rounded-xl bg-brand py-3.5 text-base font-semibold text-bg active:opacity-80 disabled:opacity-30'

  return (
    // Alcance do polegar: tudo que se toca fica na metade de baixo.
    <div className="mx-auto flex h-full w-full max-w-md flex-col px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-brand">My Money</h1>
        <p className="text-sm text-muted">
          {step === 'email' ? 'Entre com seu e-mail' : `Código enviado para ${email.trim()}`}
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void (step === 'email' ? sendCode() : verify())
        }}
        className="flex flex-col gap-3"
      >
        {error && <p className="rounded-xl bg-surface px-4 py-3 text-sm text-warning">{error}</p>}

        {step === 'email' ? (
          <>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              aria-label="E-mail"
              className={input}
            />
            <button type="submit" disabled={!emailValid || busy} className={primary}>
              {busy ? 'Enviando…' : 'Enviar código'}
            </button>
          </>
        ) : (
          <>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="000000"
              aria-label="Código"
              className={`${input} text-center text-2xl tracking-[0.4em] tabular-nums`}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setStep('email')
                  setError(null)
                }}
                className="rounded-xl px-4 text-sm text-muted active:bg-surface"
              >
                Trocar e-mail
              </button>
              <button type="submit" disabled={!codeValid || busy} className={primary}>
                {busy ? 'Entrando…' : 'Entrar'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}
