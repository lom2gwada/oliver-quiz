import { useState } from 'react'
import type { Profile, Theme } from '../types/profile'
import type { Language } from '../i18n/types'
import { useTranslation } from '../i18n'
import { playClick } from '../utils/sound'
import { supabase } from '../utils/supabase'
import { applyTheme } from '../utils/theme'

export const AVATAR_OPTIONS = ['🙂', '😎', '🤓', '🦊', '🐱', '🐶', '🦁', '🐼', '🚀', '🎯', '⭐', '🔥']

interface ProfilePageProps {
  profile: Profile | null
  onBack: () => void
  onSave: (profile: Profile) => Promise<void>
  onViewHistory: () => void
  onViewLeaderboard: () => void
  onPreviewLanguage: (language: Language) => void
}

export function ProfilePage({ profile, onBack, onSave, onViewHistory, onViewLeaderboard, onPreviewLanguage }: ProfilePageProps) {
  const { t } = useTranslation()
  const [pseudo, setPseudo] = useState(profile?.pseudo ?? '')
  const [avatar, setAvatar] = useState(profile?.avatar ?? AVATAR_OPTIONS[0])
  const [theme, setTheme] = useState<Theme>(profile?.theme ?? 'dark')
  const [language, setLanguage] = useState<Language>(profile?.language ?? 'fr')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const previewTheme = (next: Theme) => { playClick(); setTheme(next); applyTheme(next); setSaved(false) }
  const previewLanguage = (next: Language) => { playClick(); setLanguage(next); onPreviewLanguage(next); setSaved(false) }

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true); setError(''); setSaved(false)
    try {
      await onSave({ pseudo: pseudo.trim(), avatar, theme, language })
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
      <button type="button" className="secondary" onClick={onViewHistory}>{t('common.viewHistory')}</button>
      <button type="button" className="secondary" onClick={onViewLeaderboard}>{t('common.viewLeaderboard')}</button>
    </div>
    <form className="profile-form" onSubmit={submit}>
      <label>{t('profile.pseudoLabel')}
        <input value={pseudo} onChange={(event) => { setPseudo(event.target.value); setSaved(false) }} required maxLength={30} placeholder={t('profile.pseudoPlaceholder')} />
      </label>
      <fieldset className="avatar-picker">
        <legend>{t('profile.avatarLabel')}</legend>
        <div className="avatar-options">
          {AVATAR_OPTIONS.map((option) => <label key={option} className="avatar-option">
            <input type="radio" name="avatar" value={option} checked={avatar === option} onChange={() => { playClick(); setAvatar(option); setSaved(false) }} />
            <span>{option}</span>
          </label>)}
        </div>
      </fieldset>
      <fieldset className="theme-picker">
        <legend>{t('profile.themeLabel')}</legend>
        <div className="theme-options">
          <label className="theme-option">
            <input type="radio" name="theme" checked={theme === 'dark'} onChange={() => previewTheme('dark')} />
            {t('profile.themeDark')}
          </label>
          <label className="theme-option">
            <input type="radio" name="theme" checked={theme === 'light'} onChange={() => previewTheme('light')} />
            {t('profile.themeLight')}
          </label>
        </div>
      </fieldset>
      <fieldset className="theme-picker">
        <legend>{t('profile.languageLabel')}</legend>
        <div className="theme-options">
          <label className="theme-option">
            <input type="radio" name="language" checked={language === 'fr'} onChange={() => previewLanguage('fr')} />
            {t('profile.languageFr')}
          </label>
          <label className="theme-option">
            <input type="radio" name="language" checked={language === 'en'} onChange={() => previewLanguage('en')} />
            {t('profile.languageEn')}
          </label>
        </div>
      </fieldset>
      {error && <p className="alert" role="alert">{error}</p>}
      {saved && !error && <p className="profile-saved">{t('profile.saved')}</p>}
      <button type="submit" disabled={saving || !pseudo.trim()}>{saving ? t('common.saving') : t('common.save')}</button>
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
  </section>
}
