import { useState } from 'react'
import type { Profile } from '../types/profile'
import { playClick } from '../utils/sound'

export const AVATAR_OPTIONS = ['🙂', '😎', '🤓', '🦊', '🐱', '🐶', '🦁', '🐼', '🚀', '🎯', '⭐', '🔥']

interface ProfilePageProps {
  profile: Profile | null
  onBack: () => void
  onSave: (profile: Profile) => Promise<void>
}

export function ProfilePage({ profile, onBack, onSave }: ProfilePageProps) {
  const [pseudo, setPseudo] = useState(profile?.pseudo ?? '')
  const [avatar, setAvatar] = useState(profile?.avatar ?? AVATAR_OPTIONS[0])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

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

  return <section className="stats-page">
    <div className="stats-header">
      <h2>Profil</h2>
      <button type="button" className="secondary" onClick={onBack}>Retour</button>
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
  </section>
}
