import { useState } from 'react'
import { supabase } from '../utils/supabase'

export function SetPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    setLoading(true)
    setError('')
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (updateError) {
      setError('Impossible de définir le mot de passe. Redemandez un lien et réessayez.')
      return
    }
    window.history.replaceState(null, '', window.location.pathname)
    onDone()
  }

  return <main className="app-shell">
    <section className="login-page">
      <p className="eyebrow">OLIVER QUIZ</p>
      <h1>Créer votre mot de passe</h1>
      <form onSubmit={submit}>
        <label>Nouveau mot de passe
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} autoComplete="new-password" />
        </label>
        <label>Confirmer le mot de passe
          <input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required minLength={6} autoComplete="new-password" />
        </label>
        {error && <p className="alert" role="alert">{error}</p>}
        <button type="submit" disabled={loading}>{loading ? 'Validation…' : 'Valider'}</button>
      </form>
    </section>
  </main>
}
