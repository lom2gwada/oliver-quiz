import { useTranslation } from '../i18n'

/** Boutons de fin de partie communs aux 3 modes : relancer avec les mêmes paramètres, ou revenir à l'accueil de
 * paramétrage. `onRestartSame` est absent quand relancer n'a pas de sens (ex. reprise ciblée de ses erreurs). */
export function ResultActions({ onRestartSame, onBackToSettings }: { onRestartSame?: () => void; onBackToSettings: () => void }) {
  const { t } = useTranslation()
  return <div className="result-actions">
    {onRestartSame && <button type="button" onClick={onRestartSame}>{t('result.restartSame')}</button>}
    <button type="button" className={onRestartSame ? 'secondary' : undefined} onClick={onBackToSettings}>{t('result.backToSettings')}</button>
  </div>
}
