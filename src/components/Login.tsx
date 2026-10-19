import { useState } from 'react'
import { supabase } from '../utils/supabase'
import type { TranslationKey } from '../i18n'
import { useTranslation } from '../i18n'

/** `inviteLinkError` : le lien d'invitation/récupération cliqué était invalide ou expiré. Les erreurs sont gardées
 * sous forme de clé de traduction (et non de texte) pour suivre le changement de langue de l'écran. */
export function Login({ inviteLinkError = false }: { inviteLinkError?: boolean }) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(inviteLinkError ? 'auth.invalidInviteLink' : null)
  const [loading, setLoading] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setErrorKey(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) setErrorKey('auth.emailOrPasswordError')
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
        {errorKey && <p className="alert" role="alert">{t(errorKey)}</p>}
        <button type="submit" disabled={loading}>{loading ? t('auth.loggingIn') : t('auth.login')}</button>
      </form>
    </section>
  </main>
}
