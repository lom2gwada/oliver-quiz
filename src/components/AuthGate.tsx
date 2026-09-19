import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { supabase } from '../utils/supabase'
import { translate } from '../i18n'
import { hasAuthLinkError, needsPasswordSetup } from '../utils/authLink'
import App from '../App'
import { GuestQuizPage } from './GuestQuizPage'
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

  if (loading) return <main className="app-shell"><p>{translate('fr', 'common.loading')}</p></main>
  if (!session) return <Login initialError={linkError ? translate('fr', 'auth.invalidInviteLink') : ''} />
  if (settingPassword) return <SetPassword onDone={() => setSettingPassword(false)} />
  return <App onLogout={() => supabase.auth.signOut()} />
}
