import { useEffect, useState } from 'react'
import { useTranslation } from '../i18n'
import { playClick } from '@engine/utils/sound'
import { confirmDialog } from '../utils/confirmDialog'
import { dateTime } from '../utils/dateFormat'
import { downloadTextFile } from '../utils/download'
import { matchesTypedName } from '../utils/titleConfirmation'
import { userStatus, type AdminUserDetail, type AdminUserQuiz } from '../utils/adminUsers'
import {
  changeUserEmail, deleteUser, describeAuditEntry, exportUserData, fetchUserAuditLog, resendInvite, resetUserProgress, sendPasswordReset, setUserAdmin, setUserCanCreateQuizzes, setUserDisabled, setUserQuizAccess, updateUserProfile,
  soleOwnerTitles, userDataFilename, UserActionError, USER_ACTION_ERROR_KEYS, type AuditEntry, type AuditScope, type UserActionFailure,
} from '../utils/adminUserActions'
import { AVATAR_OPTIONS } from '../utils/avatars'

/** Le pseudo à retaper pour confirmer une action définitive, puis le bouton rouge, grisé tant qu'il ne correspond pas. */
export function TypedConfirm({ pseudo, buttonLabel, busy, onConfirm }: { pseudo: string; buttonLabel: string; busy: boolean; onConfirm: () => void | Promise<void> }) {
  const { t } = useTranslation()
  const [typed, setTyped] = useState('')
  return <>
    <label className="danger-confirm">
      <span>{t('userActions.confirmPrompt')} <strong className="danger-title">{pseudo}</strong></span>
      <input type="text" value={typed} onChange={(event) => setTyped(event.target.value)} placeholder={t('userActions.confirmPlaceholder')} autoComplete="off" spellCheck={false} />
    </label>
    <button type="button" className="danger" disabled={!matchesTypedName(typed, pseudo) || busy} onClick={async () => { await onConfirm(); setTyped('') }}>{busy ? t('common.loading') : buttonLabel}</button>
  </>
}

/** Zone de danger de la fiche : réinitialiser la progression, puis supprimer le compte (jamais le sien). Chacune se confirme en
 * retapant le pseudo, comme la suppression d'un quiz. */
export function UserDangerZone({ detail, busy, onReset, onDelete }: { detail: AdminUserDetail; busy: boolean; onReset: () => void | Promise<void>; onDelete: () => void | Promise<void> }) {
  const { t } = useTranslation()
  return <section className="danger-zone" aria-labelledby="user-danger-title">
    <h3 id="user-danger-title">{t('userActions.dangerTitle')}</h3>
    <div className="users-danger-block">
      <h4>{t('userActions.resetTitle')}</h4>
      <p>{t('userActions.resetWarning')}</p>
      <TypedConfirm pseudo={detail.pseudo} buttonLabel={t('userActions.resetButton')} busy={busy} onConfirm={onReset} />
    </div>
    {!detail.is_self && <div className="users-danger-block">
      <h4>{t('userActions.deleteTitle')}</h4>
      <p>{t('userActions.deleteWarning')}</p>
      <TypedConfirm pseudo={detail.pseudo} buttonLabel={t('userActions.deleteButton')} busy={busy} onConfirm={onDelete} />
    </div>}
  </section>
}

/** Pseudo et avatar : les mêmes bornes que le formulaire de profil du joueur (1 à 30 caractères, mêmes avatars). */
export function EditProfileForm({ detail, busy, onSave }: { detail: AdminUserDetail; busy: boolean; onSave: (pseudo: string, avatar: string) => void | Promise<void> }) {
  const { t } = useTranslation()
  const [pseudo, setPseudo] = useState(detail.pseudo)
  const [avatar, setAvatar] = useState(detail.avatar)
  useEffect(() => { setPseudo(detail.pseudo); setAvatar(detail.avatar) }, [detail.pseudo, detail.avatar])
  // Un avatar choisi autrement qu'avec cette liste est conservé tel quel plutôt qu'écrasé à l'enregistrement.
  const options = AVATAR_OPTIONS.includes(detail.avatar) ? AVATAR_OPTIONS : [detail.avatar, ...AVATAR_OPTIONS]
  const changed = pseudo.trim() !== detail.pseudo || avatar !== detail.avatar
  return <form className="profile-form users-edit-form" onSubmit={(event) => { event.preventDefault(); onSave(pseudo, avatar) }}>
    <label>{t('userActions.pseudoLabel')}
      <input value={pseudo} onChange={(event) => setPseudo(event.target.value)} required maxLength={30} />
    </label>
    <fieldset className="avatar-picker">
      <legend>{t('userActions.avatarLabel')}</legend>
      <div className="avatar-options">
        {options.map((option) => <label key={option} className="avatar-option">
          <input type="radio" name={`avatar-${detail.user_id}`} value={option} checked={avatar === option} onChange={() => { playClick(); setAvatar(option) }} />
          <span>{option}</span>
        </label>)}
      </div>
    </fieldset>
    <button type="submit" disabled={busy || !changed || pseudo.trim() === ''}>{t('userActions.saveButton')}</button>
  </form>
}

/** Tous les quiz avec une case « accès » : un quiz public est ouvert à tous (case cochée et grisée), les autres s'accordent un par un. */
export function UserAccessSection({ quizzes, busy, onToggle }: { quizzes: AdminUserQuiz[]; busy: boolean; onToggle: (quizId: string, granted: boolean) => void }) {
  const { t } = useTranslation()
  return <div className="users-access">
    {quizzes.map((quiz) => <label key={quiz.quiz_id} className="theme-checkbox">
      <input type="checkbox" checked={quiz.is_public || quiz.has_access} disabled={quiz.is_public || busy} onChange={(event) => { playClick(); onToggle(quiz.quiz_id, event.target.checked) }} />
      {quiz.quiz_title}{quiz.is_public && <span className="quiz-tile-badge"> — {t('userActions.accessPublic')}</span>}
    </label>)}
  </div>
}

/** Les actions du journal, la plus récente d'abord, chacune en une phrase avec sa date et son heure. */
export function AuditLogList({ entries, scope = 'user' }: { entries: AuditEntry[]; scope?: AuditScope }) {
  const { t, language } = useTranslation()
  if (entries.length === 0) return <p className="mode-hint">{t('userActions.auditEmpty')}</p>
  return <ul className="users-audit">
    {entries.map((entry) => <li key={entry.id}>
      <time dateTime={entry.created_at}>{dateTime(entry.created_at, language)}</time>
      {describeAuditEntry(entry, t, scope)}
    </li>)}
  </ul>
}

function AuditLogSection({ detail }: { detail: AdminUserDetail }) {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  const [failed, setFailed] = useState(false)
  // Rechargé à chaque nouvelle fiche (donc après chaque action, qui recharge la fiche).
  useEffect(() => {
    let current = true
    setFailed(false)
    fetchUserAuditLog(detail.user_id).then((rows) => { if (current) setEntries(rows) }).catch(() => { if (current) setFailed(true) })
    return () => { current = false }
  }, [detail])
  if (failed) return <p className="alert" role="alert">{t('userActions.auditError')}</p>
  if (!entries) return <p>{t('common.loading')}</p>
  return <AuditLogList entries={entries} />
}

/** Nouvelle adresse de connexion. Le champ se vide quand le changement a eu lieu (`onSubmit` renvoie alors vrai). */
export function ChangeEmailForm({ busy, onSubmit }: { busy: boolean; onSubmit: (email: string) => Promise<boolean> }) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  return <form className="profile-form users-email-form" onSubmit={async (event) => { event.preventDefault(); if (await onSubmit(email.trim())) setEmail('') }}>
    <label>{t('userAccounts.changeEmailLabel')}
      <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="off" maxLength={254} placeholder={t('userAccounts.emailPlaceholder')} />
    </label>
    <button type="submit" className="secondary" disabled={busy || email.trim() === ''}>{t('userAccounts.changeEmailButton')}</button>
  </form>
}

/** Droit d'accès : télécharge tout ce qu'Oliver Quiz conserve sur la personne, en JSON. Le fichier contient son email et son historique,
 * d'où la confirmation ; l'export est inscrit au journal d'audit (`onExported` recharge la fiche pour l'y montrer). Son message de réussite
 * ou d'erreur reste à côté du bouton : cette section est en bas d'une longue page. */
export function UserDataExportSection({ detail, onExported }: { detail: AdminUserDetail; onExported: () => void | Promise<void> }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<UserActionFailure | null>(null)
  const [notice, setNotice] = useState('')

  const exportData = async () => {
    setError(null)
    setNotice('')
    const confirmed = await confirmDialog({ title: t('userExport.confirmTitle'), message: t('userExport.confirm', detail.pseudo), confirmLabel: t('userExport.confirmLabel') })
    if (!confirmed) return
    setBusy(true)
    try {
      const data = await exportUserData(detail.user_id)
      downloadTextFile(userDataFilename(detail.pseudo, new Date()), JSON.stringify(data, null, 2), 'application/json')
      setNotice(t('userExport.done'))
      await Promise.resolve(onExported()).catch(() => {})
    } catch (failure) {
      setError(failure instanceof UserActionError ? failure.failure : 'failed')
    } finally {
      setBusy(false)
    }
  }

  return <>
    <h3 className="stats-group-title profile-section-title">{t('userExport.title')}</h3>
    <p className="mode-hint">{t('userExport.hint')}</p>
    <div className="users-actions">
      <button type="button" className="secondary" disabled={busy} onClick={exportData}>{busy ? t('common.loading') : t('userExport.button')}</button>
    </div>
    {error && <p className="alert" role="alert">{t(USER_ACTION_ERROR_KEYS[error])}</p>}
    {notice && <p className="profile-saved" role="status">{notice}</p>}
  </>
}

interface UserActionsPanelProps {
  detail: AdminUserDetail
  /** Recharge la fiche après une action. */
  onChanged: () => void | Promise<void>
  /** Le compte vient d'être supprimé : on quitte sa fiche. */
  onDeleted: () => void
}

/** Les actions d'un administrateur sur la fiche d'un utilisateur. Les garde-fous sont en base (`048_admin_user_actions.sql`) :
 * ici on cache seulement ce qu'ils refuseraient (son propre compte) et on traduit leurs refus. */
export function UserActionsPanel({ detail, onChanged, onDeleted }: UserActionsPanelProps) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<UserActionFailure | null>(null)
  /** Les titres des quiz qui bloquent une suppression (`soleQuizOwner`). */
  const [blockers, setBlockers] = useState<string[]>([])
  const [notice, setNotice] = useState('')
  const fail = (failure: unknown) => {
    setError(failure instanceof UserActionError ? failure.failure : 'failed')
    setBlockers(failure instanceof UserActionError && failure.failure === 'soleQuizOwner' ? soleOwnerTitles(failure.detail) : [])
  }

  /** Lance une action : un seul message d'erreur ou de réussite à la fois, la fiche rechargée ensuite. */
  const run = async (task: () => Promise<string | void>) => {
    setBusy(true)
    setError(null)
    setBlockers([])
    setNotice('')
    try {
      const message = await task()
      if (message) setNotice(message)
      // L'action a réussi : si la fiche ne se recharge pas, ce n'est pas un échec de l'action (elle se rechargera à la prochaine visite).
      await Promise.resolve(onChanged()).catch(() => {})
    } catch (failure) {
      fail(failure)
    } finally {
      setBusy(false)
    }
  }

  const toggleDisabled = async () => {
    if (!detail.disabled && !(await confirmDialog({ title: t('userActions.disableConfirmTitle'), message: t('userActions.disableConfirm', detail.pseudo), confirmLabel: t('userActions.disableConfirmLabel'), destructive: true }))) return
    await run(async () => { await setUserDisabled(detail.user_id, !detail.disabled); return detail.disabled ? t('userActions.enabledNotice') : t('userActions.disabledNotice') })
  }

  const toggleAdmin = async () => {
    const promote = !detail.is_admin
    const confirmed = await confirmDialog(promote
      ? { title: t('userActions.promoteConfirmTitle'), message: t('userActions.promoteConfirm', detail.pseudo), confirmLabel: t('userActions.promoteConfirmLabel') }
      : { title: t('userActions.demoteConfirmTitle'), message: t('userActions.demoteConfirm', detail.pseudo), confirmLabel: t('userActions.demoteConfirmLabel'), destructive: true })
    if (!confirmed) return
    await run(async () => { await setUserAdmin(detail.user_id, promote); return promote ? t('userActions.promotedNotice') : t('userActions.demotedNotice') })
  }

  const toggleCanCreate = async () => {
    const allow = !detail.can_create_quizzes
    const confirmed = await confirmDialog(allow
      ? { title: t('userActions.allowCreateConfirmTitle'), message: t('userActions.allowCreateConfirm', detail.pseudo), confirmLabel: t('userActions.allowCreateConfirmLabel') }
      : { title: t('userActions.denyCreateConfirmTitle'), message: t('userActions.denyCreateConfirm', detail.pseudo), confirmLabel: t('userActions.denyCreateConfirmLabel'), destructive: true })
    if (!confirmed) return
    await run(async () => { await setUserCanCreateQuizzes(detail.user_id, allow); return allow ? t('userActions.allowedCreateNotice') : t('userActions.deniedCreateNotice') })
  }

  const status = userStatus(detail)
  const resendInvitation = () => run(async () => { await resendInvite(detail.user_id); return t('userAccounts.resendSent', detail.email ?? '') })
  const sendReset = () => run(async () => { await sendPasswordReset(detail.user_id); return t('userAccounts.resetSent', detail.email ?? '') })
  /** Vrai si l'adresse a été changée, pour que le formulaire se vide. */
  const changeEmail = async (email: string): Promise<boolean> => {
    const confirmed = await confirmDialog({ title: t('userAccounts.changeEmailConfirmTitle'), message: t('userAccounts.changeEmailConfirm', detail.pseudo, email), confirmLabel: t('userAccounts.changeEmailConfirmLabel') })
    if (!confirmed) return false
    let changed = false
    await run(async () => { await changeUserEmail(detail.user_id, email); changed = true; return t('userAccounts.emailChanged') })
    return changed
  }
  const saveProfile = (pseudo: string, avatar: string) => run(async () => { await updateUserProfile(detail.user_id, pseudo, avatar); return t('userActions.savedNotice') })
  const toggleAccess = (quizId: string, granted: boolean) => run(async () => { await setUserQuizAccess(detail.user_id, quizId, granted) })
  const reset = () => run(async () => {
    const counts = await resetUserProgress(detail.user_id)
    const games = (counts?.quiz_results ?? 0) + (counts?.streak_results ?? 0) + (counts?.timed_results ?? 0)
    const answers = counts?.question_results ?? 0
    return games + answers + (counts?.question_progress ?? 0) === 0 ? t('userActions.resetNothing') : t('userActions.resetDone', games, answers)
  })
  const remove = async () => {
    setBusy(true)
    setError(null)
    setBlockers([])
    setNotice('')
    try {
      await deleteUser(detail.user_id)
      onDeleted()
    } catch (failure) {
      fail(failure)
    } finally {
      setBusy(false)
    }
  }

  return <>
    <h3 className="stats-group-title profile-section-title">{t('userActions.title')}</h3>
    {detail.is_self && <p className="mode-hint">{t('userActions.selfNote')}</p>}
    {!detail.is_self && <div className="users-actions">
      <button type="button" className="secondary" disabled={busy} onClick={toggleDisabled}>{detail.disabled ? t('userActions.enableButton') : t('userActions.disableButton')}</button>
      <button type="button" className="secondary" disabled={busy} onClick={toggleAdmin}>{detail.is_admin ? t('userActions.removeAdminButton') : t('userActions.makeAdminButton')}</button>
    </div>}
    {error && <p className="alert" role="alert">{t(USER_ACTION_ERROR_KEYS[error])}</p>}
    {blockers.length > 0 && <>
      <p className="mode-hint">{t('userActions.blockingQuizzes')}</p>
      <ul className="blocking-quizzes">{blockers.map((title) => <li key={title}>{title}</li>)}</ul>
    </>}
    {notice && <p className="profile-saved" role="status">{notice}</p>}

    {!detail.is_admin && <>
      <h3 className="stats-group-title">{t('userActions.canCreateTitle')}</h3>
      <p className="mode-hint">{t(detail.can_create_quizzes ? 'userActions.canCreateOnNote' : 'userActions.canCreateOffNote')}</p>
      <div className="users-actions">
        <button type="button" className="secondary" disabled={busy} onClick={toggleCanCreate}>{t(detail.can_create_quizzes ? 'userActions.denyCreateButton' : 'userActions.allowCreateButton')}</button>
      </div>
    </>}

    {!detail.is_self && <>
      <h3 className="stats-group-title">{t('userAccounts.accountTitle')}</h3>
      <div className="users-actions">
        {status === 'never' && <button type="button" className="secondary" disabled={busy} onClick={resendInvitation}>{t('userAccounts.resendButton')}</button>}
        {status === 'active' && <button type="button" className="secondary" disabled={busy} onClick={sendReset}>{t('userAccounts.resetButton')}</button>}
      </div>
      <ChangeEmailForm busy={busy} onSubmit={changeEmail} />
    </>}

    <h3 className="stats-group-title">{t('userActions.editTitle')}</h3>
    <EditProfileForm detail={detail} busy={busy} onSave={saveProfile} />

    <h3 className="stats-group-title profile-section-title">{t('userActions.accessTitle')}</h3>
    <p className="mode-hint">{t('userActions.accessHint')}</p>
    <UserAccessSection quizzes={detail.quizzes} busy={busy} onToggle={toggleAccess} />

    <h3 className="stats-group-title profile-section-title">{t('userActions.auditTitle')}</h3>
    <p className="mode-hint">{t('userActions.auditHint')}</p>
    <AuditLogSection detail={detail} />

    <UserDataExportSection detail={detail} onExported={onChanged} />

    <UserDangerZone detail={detail} busy={busy} onReset={reset} onDelete={remove} />
  </>
}
