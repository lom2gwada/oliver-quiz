import { useState } from 'react'
import type { Profile } from '../types/profile'
import { playClick } from '../utils/sound'
import { supabase } from '../utils/supabase'

export const AVATAR_OPTIONS = ['🙂', '😎', '🤓', '🦊', '🐱', '🐶', '🦁', '🐼', '🚀', '🎯', '⭐', '🔥']

interface ProfilePageProps {
  profile: Profile | null
  onBack: () => void
  onSave: (profile: Profile) => Promise<void>
  onViewHistory: () => void
  onViewLeaderboard: () => void
}

export function ProfilePage({ profile, onBack, onSave, onViewHistory, onViewLeaderboard }: ProfilePageProps) {
  const [pseudo, setPseudo] = useState(profile?.pseudo ?? '')
  const [avatar, setAvatar] = useState(profile?.avatar ?? AVATAR_OPTIONS[0])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true); setError(''); setSaved(false)
    try {
      await onSave({ pseudo: pseudo.trim(), avatar })
      setSaved(true)
    } catch {
      setError("Impossible d'enregistrer le profil. Réessayez.")
    } finally {
      setSaving(false)
    }
  }

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault()
    if (password !== confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas.')
      return
    }
    setPasswordSaving(true); setPasswordError(''); setPasswordSaved(false)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setPasswordSaving(false)
    if (updateError) {
      setPasswordError('Impossible de modifier le mot de passe. Réessayez.')
      return
    }
    setPassword(''); setConfirmPassword(''); setPasswordSaved(true)
  }

  return <section className="stats-page">
    <div className="stats-header">
      <h2>Profil</h2>
      <button type="button" className="secondary" onClick={onBack}>Retour</button>
    </div>
    <div className="nav-links">
      <button type="button" className="secondary" onClick={onViewHistory}>🕓 Historique</button>
      <button type="button" className="secondary" onClick={onViewLeaderboard}>🏆 Classement</button>
    </div>
    <form className="profile-form" onSubmit={submit}>
      <label>Pseudo
        <input value={pseudo} onChange={(event) => { setPseudo(event.target.value); setSaved(false) }} required maxLength={30} placeholder="Ton prénom ou pseudo" />
      </label>
      <fieldset className="avatar-picker">
        <legend>Avatar</legend>
        <div className="avatar-options">
          {AVATAR_OPTIONS.map((option) => <label key={option} className="avatar-option">
            <input type="radio" name="avatar" value={option} checked={avatar === option} onChange={() => { playClick(); setAvatar(option); setSaved(false) }} />
            <span>{option}</span>
          </label>)}
        </div>
      </fieldset>
      {error && <p className="alert" role="alert">{error}</p>}
      {saved && !error && <p className="profile-saved">Profil enregistré ✓</p>}
      <button type="submit" disabled={saving || !pseudo.trim()}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
    </form>

    <h3 className="stats-group-title profile-section-title">Mot de passe</h3>
    <form className="profile-form" onSubmit={submitPassword}>
      <label>Nouveau mot de passe
        <input type="password" value={password} onChange={(event) => { setPassword(event.target.value); setPasswordSaved(false) }} required minLength={6} autoComplete="new-password" />
      </label>
      <label>Confirmer le mot de passe
        <input type="password" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setPasswordSaved(false) }} required minLength={6} autoComplete="new-password" />
      </label>
      {passwordError && <p className="alert" role="alert">{passwordError}</p>}
      {passwordSaved && !passwordError && <p className="profile-saved">Mot de passe modifié ✓</p>}
      <button type="submit" disabled={passwordSaving}>{passwordSaving ? 'Modification…' : 'Modifier le mot de passe'}</button>
    </form>
  </section>
}
