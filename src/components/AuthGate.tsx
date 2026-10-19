import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { supabase } from '../utils/supabase'
import { LanguageProvider, translate } from '../i18n'
import type { Language } from '../i18n'
import { readStoredLanguage, storeLanguage } from '../utils/languagePreference'
import { hasAuthLinkError, needsPasswordSetup } from '../utils/authLink'
import App from '../App'
import { GuestQuizPage } from './GuestQuizPage'
import { LanguageSwitch } from './LanguageSwitch'
import { Login } from './Login'
import { SetPassword } from './SetPassword'

/** Un lien invité (`?g=<token>`) court-circuite toute l'authentification : ni écran de connexion, ni session
 * créée — le répondant n'a pas de compte. Le composant de session est séparé pour que ses effets (lecture de
 * session, abonnement auth) ne tournent jamais pour un invité. */
export function AuthGate() {
  const guestToken = new URLSearchParams(window.location.search).get('g')
  return guestToken ? <GuestQuizPage token={guestToken} /> : <SessionGate />
}

function SessionGate() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [settingPassword, setSettingPassword] = useState(() => needsPasswordSetup(window.location.hash))
  const [linkError] = useState(() => hasAuthLinkError(window.location.hash))
  // Langue des écrans d'avant connexion (pas de profil à ce stade) : la dernière utilisée sur cet appareil.
  const [preLoginLanguage, setPreLoginLanguage] = useState<Language>(() => readStoredLanguage() ?? 'fr')
  const chooseLanguage = (next: Language) => { setPreLoginLanguage(next); storeLanguage(next, true) }

  useEffect(() => {
    if (/access_token=|error=/.test(window.location.hash)) window.history.replaceState(null, '', window.location.pathname)
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'PASSWORD_RECOVERY') setSettingPassword(true)
    })
    return () => subscription.subscription.unsubscribe()
  }, [])

  // Après une déconnexion, l'écran de connexion reprend la langue utilisée dans l'appli.
  useEffect(() => { if (!session) setPreLoginLanguage(readStoredLanguage() ?? 'fr') }, [session])

  const preLogin = (screen: React.ReactNode) => <LanguageProvider language={preLoginLanguage}>
    <div className="prelogin-language"><LanguageSwitch value={preLoginLanguage} onChange={chooseLanguage} /></div>
    {screen}
  </LanguageProvider>

  if (loading) return <main className="app-shell"><p>{translate(preLoginLanguage, 'common.loading')}</p></main>
  if (!session) return preLogin(<Login inviteLinkError={linkError} />)
  if (settingPassword) return preLogin(<SetPassword onDone={() => setSettingPassword(false)} />)
  return <App onLogout={() => supabase.auth.signOut()} />
}
