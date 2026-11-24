import { useEffect, useState } from 'react'
import { useTranslation } from '../i18n'
import { confirmDialog, type ConfirmOptions } from '../utils/confirmDialog'
import { addQuizAdminConfirm, changeQuizRoleConfirm, leaveQuizConfirm, removeQuizAdminConfirm } from '../utils/confirmPresets'
import { longDate } from '../utils/dateFormat'
import { listQuizAdmins, QUIZ_ADMIN_ERROR_KEYS, QuizAdminError, removeQuizAdmin, setQuizAdminRole, type QuizAdmin, type QuizRole } from '../utils/quizAdmins'
import { QuizUserSearch } from './QuizUserSearch'

interface QuizAdminsPanelProps {
  quizId: string
  quizTitle: string
  /** Propriétaire (ou administrateur global) : peut ajouter, retirer, promouvoir et rétrograder. Sinon, la liste se lit seulement et on peut s'en retirer. */
  isOwner: boolean
  /** Le compte connecté vient de changer son propre rôle (`left` : il n'administre plus ce quiz) : l'appelant relit ses droits. */
  onSelfChanged: (left: boolean) => void
}

/** Les propriétaires et administrateurs d'un quiz (`quiz_admins_list`, 051) et leur gestion. Les droits sont contrôlés en base :
 * les boutons masqués ici ne sont qu'un confort, une action refusée affiche la raison (dernier propriétaire, compte désactivé…).
 * Chaque changement demande confirmation. */
export function QuizAdminsPanel({ quizId, quizTitle, isOwner, onSelfChanged }: QuizAdminsPanelProps) {
  const { t, language } = useTranslation()
  const [admins, setAdmins] = useState<QuizAdmin[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const load = () => listQuizAdmins(quizId).then((list) => { setAdmins(list); setLoadFailed(false) }).catch(() => setLoadFailed(true))
  useEffect(() => { setAdmins(null); setLoadFailed(false); setError(''); setNotice(''); load() }, [quizId])

  /** Confirme, exécute, puis relit la liste. `affectsSelf` : `'left'` si l'action retire le compte connecté, `'role'` s'il change son rôle. */
  const change = async (options: ConfirmOptions, action: () => Promise<void>, done: string, affectsSelf: 'left' | 'role' | null = null) => {
    if (!(await confirmDialog(options))) return
    setBusy(true); setError(''); setNotice('')
    try {
      await action()
      setNotice(done)
      if (affectsSelf) onSelfChanged(affectsSelf === 'left')
      if (affectsSelf !== 'left') { await load(); setRefreshKey((key) => key + 1) }
    } catch (failure) {
      setError(t(QUIZ_ADMIN_ERROR_KEYS[failure instanceof QuizAdminError ? failure.failure : 'failed']))
      await load()
    } finally { setBusy(false) }
  }

  const add = (match: { user_id: string; pseudo: string }) => change(addQuizAdminConfirm(t, match.pseudo, quizTitle), () => setQuizAdminRole(quizId, match.user_id, 'admin'), t('quizAdmin.noticeAdded', match.pseudo))
  const setRole = (member: QuizAdmin, role: QuizRole) => change(
    changeQuizRoleConfirm(t, member.pseudo, quizTitle, role),
    () => setQuizAdminRole(quizId, member.user_id, role),
    t(role === 'owner' ? 'quizAdmin.noticeOwner' : 'quizAdmin.noticeDemoted', member.pseudo),
    member.is_self ? 'role' : null,
  )
  const remove = (member: QuizAdmin) => change(
    member.is_self ? leaveQuizConfirm(t, quizTitle) : removeQuizAdminConfirm(t, member.pseudo, quizTitle),
    () => removeQuizAdmin(quizId, member.user_id),
    t(member.is_self ? 'quizAdmin.noticeLeft' : 'quizAdmin.noticeRemoved', member.pseudo),
    member.is_self ? 'left' : null,
  )

  const roleLabel = (role: QuizRole | null) => t(role === 'owner' ? 'quizAdmin.roleOwner' : 'quizAdmin.roleAdmin')

  return <div className="quiz-admins">
    <p className="mode-hint">{t(isOwner ? 'quizAdmin.intro' : 'quizAdmin.introAdmin')}</p>
    {loadFailed && <p className="alert" role="alert">{t('quizAdmin.loadError')} <button type="button" className="secondary alert-retry" onClick={load}>{t('start.retry')}</button></p>}
    {!admins && !loadFailed && <p className="mode-hint">{t('common.loading')}</p>}
    {admins && <ul className="quiz-admin-list">
      {admins.map((member) => <li key={member.user_id} className="quiz-admin-item">
        <div className="quiz-admin-who">
          <span className="quiz-user-name">{member.avatar} {member.pseudo}</span>
          {member.is_self && <span className="quiz-admin-tag">{t('quizAdmin.you')}</span>}
          <span className={member.role === 'owner' ? 'quiz-admin-tag quiz-admin-owner' : 'quiz-admin-tag'}>{roleLabel(member.role)}</span>
          {member.disabled && <span className="quiz-admin-tag">{t('quizAdmin.disabledBadge')}</span>}
        </div>
        <p className="mode-hint quiz-admin-added">{member.added_by_pseudo ? t('quizAdmin.addedBy', member.added_by_pseudo, longDate(member.added_at, language)) : t('quizAdmin.addedOn', longDate(member.added_at, language))}</p>
        <div className="quiz-admin-actions">
          {isOwner && (member.role === 'admin'
            ? <button type="button" className="secondary" disabled={busy} onClick={() => setRole(member, 'owner')}>{t('quizAdmin.makeOwner')}</button>
            : <button type="button" className="secondary" disabled={busy} onClick={() => setRole(member, 'admin')}>{t('quizAdmin.makeAdmin')}</button>)}
          {(isOwner || member.is_self) && <button type="button" className="secondary" disabled={busy} onClick={() => remove(member)}>{t(member.is_self ? 'quizAdmin.leave' : 'quizAdmin.remove')}</button>}
        </div>
      </li>)}
    </ul>}
    {error && <p className="alert" role="alert">{error}</p>}
    {notice && <p className="profile-saved" role="status">{notice}</p>}
    {isOwner && <>
      <h4 className="quiz-admin-add-title">{t('quizAdmin.addTitle')}</h4>
      <QuizUserSearch
        quizId={quizId}
        refreshKey={refreshKey}
        renderAction={(match) => match.role
          ? <span className="quiz-admin-tag">{roleLabel(match.role)}</span>
          : <button type="button" className="secondary" disabled={busy} onClick={() => add(match)}>{t('quizAdmin.add')}</button>}
      />
    </>}
  </div>
}
