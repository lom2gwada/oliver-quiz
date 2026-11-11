import { useTranslation } from '../i18n'

/** Liens de fin de partie communs aux 3 modes, sous les boutons « Rejouer » / « Retour aux paramètres » : l'historique, le
 * classement et « Mes quiz » (la progression de tous ses quiz, pour passer à un autre quiz sans repasser par l'accueil). */
export function ResultNavLinks({ onViewHistory, onViewLeaderboard, onViewOverview }: { onViewHistory: () => void; onViewLeaderboard: () => void; onViewOverview: () => void }) {
  const { t } = useTranslation()
  return <div className="nav-links">
    <button type="button" className="secondary" onClick={onViewHistory}>{t('common.viewHistory')}</button>
    <button type="button" className="secondary" onClick={onViewLeaderboard}>{t('common.viewLeaderboard')}</button>
    <button type="button" className="secondary" onClick={onViewOverview}>{t('nav.overview')}</button>
  </div>
}
