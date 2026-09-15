import { useState } from 'react'
import { supabase } from '../utils/supabase'
import type { TranslationKey } from '../i18n'
import { translate } from '../i18n'

const t = (key: TranslationKey) => translate('fr', key)

export function Login({ initialError = '' }: { initialError?: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(initialError)
  const [loading, setLoading] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) setError(t('auth.emailOrPasswordError'))
    setLoading(false)
  }

  return <main className="app-shell">
    <section className="login-page">
      <p className="eyebrow">OLIVER QUIZ</p>
      <h1>{t('auth.loginTitle')}</h1>
      <form onSubmit={submit}>
        <label>{t('auth.emailLabel')}
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
        </label>
        <label>{t('profile.passwordTitle')}
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
        </label>
        {error && <p className="alert" role="alert">{error}</p>}
        <button type="submit" disabled={loading}>{loading ? t('auth.loggingIn') : t('auth.login')}</button>
      </form>
    </section>
  </main>
}
