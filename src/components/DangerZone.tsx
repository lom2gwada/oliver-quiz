import { useState } from 'react'
import { useTranslation } from '../i18n'
import { matchesQuizTitle } from '../utils/titleConfirmation'

interface DangerZoneProps {
  title: string
  onExport: () => void
  onDelete: (deleteHistoryToo: boolean) => Promise<void>
  /** Erreur de la dernière tentative de suppression, affichée dans la zone. */
  error: string
}

/** Zone de danger, en bas de la fiche d'un quiz : la suppression est définitive et emporte les accès, les liens
 * invités et la progression de révision de tous les joueurs. Elle se fait en trois temps explicites — exporter le quiz
 * (proposé, pas imposé), choisir de purger ou non l'historique, puis retaper le titre du quiz — plutôt que par une
 * simple boîte « OK / Annuler » facile à valider par réflexe. */
export function DangerZone({ title, onExport, onDelete, error }: DangerZoneProps) {
  const { t } = useTranslation()
  const [deleteHistoryToo, setDeleteHistoryToo] = useState(false)
  const [typed, setTyped] = useState('')
  const [exported, setExported] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const remove = async () => {
    setDeleting(true)
    try { await onDelete(deleteHistoryToo) } finally { setDeleting(false) }
  }

  return <section className="danger-zone" aria-labelledby="danger-zone-title">
    <h3 id="danger-zone-title">{t('admin.dangerZoneTitle')}</h3>
    <p>{t('admin.dangerZoneIntro')}</p>
    <div className="danger-step">
      <button type="button" className="secondary" onClick={() => { onExport(); setExported(true) }}>{t('admin.exportBeforeDeleteButton')}</button>
      {exported && <span className="profile-saved" role="status">{t('admin.exportedNotice')}</span>}
    </div>
    <label className="theme-checkbox">
      <input type="checkbox" checked={deleteHistoryToo} onChange={(event) => setDeleteHistoryToo(event.target.checked)} />
      {t('admin.deleteHistoryTooLabel')}
    </label>
    <label className="danger-confirm">
      <span>{t('admin.dangerConfirmPrompt')} <strong className="danger-title">{title}</strong></span>
      <input type="text" value={typed} onChange={(event) => setTyped(event.target.value)} placeholder={t('admin.dangerConfirmPlaceholder')} autoComplete="off" spellCheck={false} />
    </label>
    {error && <p className="alert" role="alert">{error}</p>}
    <button type="button" className="danger" onClick={remove} disabled={!matchesQuizTitle(typed, title) || deleting}>{deleting ? t('common.loading') : t('admin.deleteQuizButton')}</button>
  </section>
}
