import type { Language } from '../i18n/types'
import { useTranslation } from '../i18n'
import type { Profile } from '../types/profile'
import type { View } from '../utils/routes'
import { LanguageSwitch } from './LanguageSwitch'

interface AppBarProps {
  view: View
  muted: boolean
  profile: Profile | null
  onLanguageChange: (language: Language) => void
  onToggleSound: () => void
  onHome: () => void
  onProfile: () => void
  onAdmin: () => void
  onLogout: () => void
}

/** Barre supérieure, la même sur toutes les pages : nom de l'appli (retour à l'accueil), langue, son, profil,
 * administration (comptes admin), déconnexion. La page courante est signalée sur Profil et Administration. */
export function AppBar({ view, muted, profile, onLanguageChange, onToggleSound, onHome, onProfile, onAdmin, onLogout }: AppBarProps) {
  const { t, language } = useTranslation()
  const onAdminPage = view === 'quizzes' || view === 'quizDetail'
  return <div className="app-bar">
    <button type="button" className="app-name" onClick={onHome} aria-label={t('nav.goHome')}>OLIVER QUIZ</button>
    <div className="header-actions">
      <LanguageSwitch value={language} onChange={onLanguageChange} />
      <button type="button" className="secondary" onClick={onToggleSound} aria-label={muted ? t('nav.unmuteSound') : t('nav.muteSound')}>{muted ? '🔇' : '🔊'}</button>
      <button type="button" className="secondary" onClick={onProfile} aria-current={view === 'profile' ? 'page' : undefined}>{profile ? `${profile.avatar} ${profile.pseudo}` : t('nav.profile')}</button>
      {profile?.isAdmin && <button type="button" className="secondary" onClick={onAdmin} aria-current={onAdminPage ? 'page' : undefined}>{t('nav.quiz')}</button>}
      <button type="button" className="secondary" onClick={onLogout}>{t('common.logout')}</button>
    </div>
  </div>
}
