import { useState } from 'react'
import { supabase } from '../utils/supabase'
import type { TranslationKey } from '../i18n'
import { translate } from '../i18n'

const t = (key: TranslationKey) => translate('fr', key)

export function SetPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (password !== confirm) {
      setError(t('profile.passwordMismatch'))
      return
    }
    setLoading(true)
    setError('')
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (updateError) {
      setError(t('auth.setPasswordError'))
      return
    }
    window.history.replaceState(null, '', window.location.pathname)
    onDone()
  }

  return <main className="app-shell">
    <section className="login-page">
      <p className="eyebrow">OLIVER QUIZ</p>
      <h1>{t('auth.setPasswordTitle')}</h1>
      <form onSubmit={submit}>
        <label>{t('profile.newPasswordLabel')}
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} autoComplete="new-password" />
        </label>
        <label>{t('profile.confirmPasswordLabel')}
          <input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required minLength={6} autoComplete="new-password" />
        </label>
        {error && <p className="alert" role="alert">{error}</p>}
        <button type="submit" disabled={loading}>{loading ? t('auth.validating') : t('auth.validate')}</button>
      </form>
    </section>
  </main>
}
