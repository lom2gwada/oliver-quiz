import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { supabase } from '../utils/supabase'
import { hasAuthLinkError, needsPasswordSetup } from '../utils/authLink'
import App from '../App'
import { Login } from './Login'
import { SetPassword } from './SetPassword'

export function AuthGate() {
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

  if (loading) return <main className="app-shell"><p>Chargement…</p></main>
  if (!session) return <Login initialError={linkError ? "Lien d'invitation invalide ou expiré. Redemandez une invitation." : ''} />
  if (settingPassword) return <SetPassword onDone={() => setSettingPassword(false)} />
  return <App onLogout={() => supabase.auth.signOut()} />
}
