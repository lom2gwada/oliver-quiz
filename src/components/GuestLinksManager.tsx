import { useEffect, useState } from 'react'
import type { GuestLink, GuestLinkMode } from '../types/guestLink'
import { useTranslation } from '../i18n'
import { createGuestLink, deleteGuestLink, fetchGuestLinks } from '../utils/guestLinks'
import type { Quiz } from '../types/quiz'
import { GuestResultsPanel } from './GuestResultsPanel'

const guestLinkUrl = (token: string) => `${window.location.origin}${window.location.pathname}?g=${token}`

/** Admin uniquement : créer/lister/révoquer les liens invités d'un quiz (réponse sans compte, cf. plan
 * "Liens invités"). La lecture/l'écriture passent par RLS (policies admin-only sur `guest_links`) ; la
 * lecture/l'écriture anonymes côté invité passent par des fonctions SECURITY DEFINER séparées. */
export function GuestLinksManager({ quizId, quiz }: { quizId: string; quiz: Quiz }) {
  const { t, language } = useTranslation()
  const [links, setLinks] = useState<GuestLink[] | null>(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<GuestLinkMode>('test')
  const [label, setLabel] = useState('')
  const [creating, setCreating] = useState(false)
  const [copiedToken, setCopiedToken] = useState('')
  const [openResultsToken, setOpenResultsToken] = useState('')

  useEffect(() => {
    fetchGuestLinks(quizId).then(setLinks).catch(() => setError(t('admin.errorLoadGuestLinks')))
  }, [quizId])

  const create = async () => {
    setCreating(true)
    setError('')
    try {
      const created = await createGuestLink(quizId, mode, label.trim())
      setLinks((current) => [created, ...(current ?? [])])
      setLabel('')
    } catch {
      setError(t('admin.errorCreateGuestLink'))
    } finally {
      setCreating(false)
    }
  }

  const remove = async (token: string) => {
    if (!window.confirm(t('admin.confirmDeleteGuestLink'))) return
    setError('')
    try {
      await deleteGuestLink(token)
      setLinks((current) => (current ?? []).filter((link) => link.token !== token))
    } catch {
      setError(t('admin.errorDeleteGuestLink'))
    }
  }

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(guestLinkUrl(token))
      setCopiedToken(token)
      setTimeout(() => setCopiedToken((current) => (current === token ? '' : current)), 2000)
    } catch { /* presse-papier indisponible (contexte non sécurisé) : le lien reste affichable/sélectionnable à la main */ }
  }

  return <div className="quiz-access-list">
    <p className="mode-hint">{t('admin.guestLinksHint')}</p>
    <div className="question-create-bar">
      <select value={mode} onChange={(event) => setMode(event.target.value as GuestLinkMode)}>
        <option value="test">{t('admin.guestLinkModeTest')}</option>
        <option value="survey">{t('admin.guestLinkModeSurvey')}</option>
      </select>
      <input type="text" value={label} onChange={(event) => setLabel(event.target.value)} placeholder={t('admin.guestLinkLabelPlaceholder')} />
      <button type="button" onClick={create} disabled={creating}>{t('admin.createGuestLinkButton')}</button>
    </div>
    {error && <p className="alert" role="alert">{error}</p>}
    {links && links.length === 0 && <p>{t('admin.noGuestLinks')}</p>}
    {links && links.length > 0 && links.map((link) => <div key={link.token} className="quiz-access-item">
      <h4>{link.label || t('admin.guestLinkUnlabeled')} — {link.mode === 'test' ? t('admin.guestLinkModeTest') : t('admin.guestLinkModeSurvey')}</h4>
      <p className="quiz-description">{new Date(link.created_at).toLocaleDateString(language === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
      <div className="question-create-bar">
        <input type="text" className="text-answer" readOnly value={guestLinkUrl(link.token)} onFocus={(event) => event.target.select()} />
        <button type="button" className="secondary" onClick={() => copy(link.token)}>{copiedToken === link.token ? t('admin.guestLinkCopiedFeedback') : t('admin.guestLinkCopyButton')}</button>
        <button type="button" className="secondary" onClick={() => setOpenResultsToken((current) => current === link.token ? '' : link.token)}>{openResultsToken === link.token ? t('admin.guestResultsHide') : t('admin.guestResultsShow')}</button>
        <button type="button" className="danger" onClick={() => remove(link.token)}>{t('admin.deleteGuestLinkButton')}</button>
      </div>
      {openResultsToken === link.token && <GuestResultsPanel link={link} quiz={quiz} />}
    </div>)}
  </div>
}
