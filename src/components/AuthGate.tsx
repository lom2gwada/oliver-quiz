import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { supabase } from '../utils/supabase'
import App from '../App'
import { Login } from './Login'
import { SetPassword } from './SetPassword'

const needsPasswordSetup = () => /type=(invite|recovery)/.test(window.location.hash)

export function AuthGate() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [settingPassword, setSettingPassword] = useState(needsPasswordSetup)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => subscription.subscription.unsubscribe()
  }, [])

  if (loading) return <main className="app-shell"><p>Chargement…</p></main>
  if (!session) return <Login />
  if (settingPassword) return <SetPassword onDone={() => setSettingPassword(false)} />
  return <App onLogout={() => supabase.auth.signOut()} />
}
