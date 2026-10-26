import { useEffect, useRef, useState } from 'react'
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
 * administration (comptes admin), déconnexion. La page courante est signalée sur Profil et Administration.
 * Sur téléphone, la barre tient sur une ligne : les commandes passent derrière un bouton ☰ (voir `styles.css`) ; ce
 * menu se referme après un choix, avec Échap, en touchant ailleurs ou en changeant de page. */
export function AppBar({ view, muted, profile, onLanguageChange, onToggleSound, onHome, onProfile, onAdmin, onLogout }: AppBarProps) {
  const { t, language } = useTranslation()
  const onAdminPage = view === 'quizzes' || view === 'quizDetail'
  const [menuOpen, setMenuOpen] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMenuOpen(false) }, [view])
  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: PointerEvent) => { if (barRef.current && !barRef.current.contains(event.target as Node)) setMenuOpen(false) }
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown) }
  }, [menuOpen])

  const thenClose = (action: () => void) => () => { setMenuOpen(false); action() }

  return <div className={menuOpen ? 'app-bar app-bar-open' : 'app-bar'} ref={barRef}>
    <button type="button" className="app-name" onClick={thenClose(onHome)} aria-label={t('nav.goHome')}>OLIVER QUIZ</button>
    <button type="button" className="secondary app-menu-toggle" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-controls="app-menu" aria-label={t('nav.menu')}>{menuOpen ? '✕' : '☰'}</button>
    <div className="header-actions" id="app-menu">
      <LanguageSwitch value={language} onChange={(next) => { setMenuOpen(false); onLanguageChange(next) }} />
      <button type="button" className="secondary" onClick={thenClose(onToggleSound)} aria-label={muted ? t('nav.unmuteSound') : t('nav.muteSound')}>{muted ? '🔇' : '🔊'}</button>
      <button type="button" className="secondary" onClick={thenClose(onProfile)} aria-current={view === 'profile' ? 'page' : undefined}>{profile ? `${profile.avatar} ${profile.pseudo}` : t('nav.profile')}</button>
      {profile?.isAdmin && <button type="button" className="secondary" onClick={thenClose(onAdmin)} aria-current={onAdminPage ? 'page' : undefined}>{t('nav.quiz')}</button>}
      <button type="button" className="secondary" onClick={thenClose(onLogout)}>{t('common.logout')}</button>
    </div>
  </div>
}
