import { useEffect, useState } from 'react'
import type { Profile, Theme } from '../types/profile'
import { useTranslation } from '../i18n'
import { playClick } from '@engine/utils/sound'
import { supabase } from '../utils/supabase'
import { applyTheme } from '../utils/theme'
import { isPseudoDirty } from '../utils/profileDraft'

export const AVATAR_OPTIONS = ['🙂', '😎', '🤓', '🦊', '🐱', '🐶', '🦁', '🐼', '🚀', '🎯', '⭐', '🔥']

interface ProfilePageProps {
  profile: Profile | null
  onBack: () => void
  onSave: (profile: Profile) => Promise<void>
  onViewOverview: () => void
  /** Signale à l'appli que le pseudo saisi n'est pas enregistré : elle demande confirmation avant de quitter la page. */
  onDirtyChange: (dirty: boolean) => void
}

export function ProfilePage({ profile, onBack, onSave, onViewOverview, onDirtyChange }: ProfilePageProps) {
  const { t } = useTranslation()
  // La page est remontée (voir `key` dans App) quand le profil arrive : ces valeurs partent toujours du profil enregistré.
  const [pseudo, setPseudo] = useState(profile?.pseudo ?? '')
  const [avatar, setAvatar] = useState(profile?.avatar ?? AVATAR_OPTIONS[0])
  const [theme, setTheme] = useState<Theme>(profile?.theme ?? 'dark')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const dirty = isPseudoDirty(profile, pseudo)
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false) }, [dirty])
  // Fermer ou recharger l'onglet avec un pseudo non enregistré : le navigateur demande confirmation.
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  /** Thème et avatar s'enregistrent dès le clic, sans passer par « Enregistrer » : l'aperçu ne peut plus rester affiché
   * sans être enregistré. Le pseudo, lui, garde son bouton. En cas d'échec, le choix précédent est rétabli. */
  const saveChoice = async (next: { avatar?: string; theme?: Theme }) => {
    const previous = { avatar, theme }
    const choice = { avatar: next.avatar ?? avatar, theme: next.theme ?? theme }
    setAvatar(choice.avatar); setTheme(choice.theme); applyTheme(choice.theme); setError(''); setSaved(false)
    if (!profile) return
    try {
      await onSave({ ...profile, avatar: choice.avatar, theme: choice.theme })
      setSaved(true)
    } catch {
      setAvatar(previous.avatar); setTheme(previous.theme); applyTheme(previous.theme)
      setError(t('profile.errorSave'))
    }
  }

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true); setError(''); setSaved(false)
    try {
      // La langue ne se règle plus ici mais depuis l'en-tête (`LanguageSwitch`) : on repasse celle du profil telle
      // qu'elle est au moment de l'envoi, pour ne jamais écraser un changement fait entre-temps.
      await onSave({ pseudo: pseudo.trim(), avatar, theme, language: profile?.language ?? 'fr' })
      setPseudo((current) => current.trim())
      setSaved(true)
    } catch {
      setError(t('profile.errorSave'))
    } finally {
      setSaving(false)
    }
  }

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault()
    if (password !== confirmPassword) {
      setPasswordError(t('profile.passwordMismatch'))
      return
    }
    setPasswordSaving(true); setPasswordError(''); setPasswordSaved(false)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setPasswordSaving(false)
    if (updateError) {
      setPasswordError(t('profile.errorPassword'))
      return
    }
    setPassword(''); setConfirmPassword(''); setPasswordSaved(true)
  }

  return <section className="stats-page">
    <div className="stats-header">
      <h2>{t('profile.title')}</h2>
      <button type="button" className="secondary" onClick={onBack}>{t('common.back')}</button>
    </div>
    <div className="nav-links">
      <button type="button" className="secondary" onClick={onViewOverview}>{t('nav.overview')}</button>
    </div>
    <form className="profile-form" onSubmit={submit}>
      <label>{t('profile.pseudoLabel')}
        <input value={pseudo} onChange={(event) => { setPseudo(event.target.value); setSaved(false) }} required maxLength={30} placeholder={t('profile.pseudoPlaceholder')} />
      </label>
      <fieldset className="avatar-picker">
        <legend>{t('profile.avatarLabel')}</legend>
        <div className="avatar-options">
          {AVATAR_OPTIONS.map((option) => <label key={option} className="avatar-option">
            <input type="radio" name="avatar" value={option} checked={avatar === option} onChange={() => { playClick(); saveChoice({ avatar: option }) }} />
            <span>{option}</span>
          </label>)}
        </div>
      </fieldset>
      <fieldset className="theme-picker">
        <legend>{t('profile.themeLabel')}</legend>
        <div className="theme-options">
          <label className="theme-option">
            <input type="radio" name="theme" checked={theme === 'dark'} onChange={() => { playClick(); saveChoice({ theme: 'dark' }) }} />
            {t('profile.themeDark')}
          </label>
          <label className="theme-option">
            <input type="radio" name="theme" checked={theme === 'light'} onChange={() => { playClick(); saveChoice({ theme: 'light' }) }} />
            {t('profile.themeLight')}
          </label>
        </div>
      </fieldset>
      <p className="mode-hint profile-autosave-hint">{t('profile.autosaveHint')}</p>
      {error && <p className="alert" role="alert">{error}</p>}
      {saved && !error && !dirty && <p className="profile-saved">{t('profile.saved')}</p>}
      {dirty && <p className="profile-unsaved" role="status">{t('profile.unsaved')}</p>}
      <button type="submit" disabled={saving || !pseudo.trim() || !dirty}>{saving ? t('common.saving') : t('common.save')}</button>
    </form>

    <h3 className="stats-group-title profile-section-title">{t('profile.passwordTitle')}</h3>
    <form className="profile-form" onSubmit={submitPassword}>
      <label>{t('profile.newPasswordLabel')}
        <input type="password" value={password} onChange={(event) => { setPassword(event.target.value); setPasswordSaved(false) }} required minLength={6} autoComplete="new-password" />
      </label>
      <label>{t('profile.confirmPasswordLabel')}
        <input type="password" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setPasswordSaved(false) }} required minLength={6} autoComplete="new-password" />
      </label>
      {passwordError && <p className="alert" role="alert">{passwordError}</p>}
      {passwordSaved && !passwordError && <p className="profile-saved">{t('profile.passwordSaved')}</p>}
      <button type="submit" disabled={passwordSaving}>{passwordSaving ? t('profile.changingPassword') : t('profile.changePassword')}</button>
    </form>
    <p className="profile-about-link"><a href="#/a-propos">{t('about.link')}</a></p>
  </section>
}
