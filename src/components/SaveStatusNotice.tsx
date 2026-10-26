import { useTranslation } from '../i18n'
import type { SaveStatus } from '../utils/gameSave'

/** Affichée au-dessus d'un écran de résultat : prévient discrètement que la partie n'a pas pu être enregistrée (même
 * après les reprises automatiques) et propose de relancer l'enregistrement. Rien n'est affiché tant que tout va bien. */
export function SaveStatusNotice({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  const { t } = useTranslation()
  if (status.state === 'recovered') return <p className="profile-saved save-notice" role="status">{t('save.recovered')}</p>
  if (status.state !== 'failed' && status.state !== 'retrying') return null
  const retrying = status.state === 'retrying'
  return <p className="alert save-notice" role="alert">
    {t('save.failed')} <button type="button" className="secondary alert-retry" onClick={onRetry} disabled={retrying}>{retrying ? t('save.retrying') : t('save.retry')}</button>
  </p>
}
