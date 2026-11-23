import { useEffect, useState } from 'react'
import type { TranslationKey } from '../i18n'
import { useTranslation } from '../i18n'
import type { HostedQuizSummary } from '../types/hostedQuiz'
import { confirmDialog, type ConfirmOptions } from '../utils/confirmDialog'
import { fetchAccessibleQuizzes } from '../utils/hostedQuizzes'
import { setUserDisabled, setUserQuizAccess, USER_ACTION_ERROR_KEYS } from '../utils/adminUserActions'
import { namesPreview, planBulk, runBulk, type BulkAction, type BulkResult } from '../utils/adminUserBulk'
import type { AdminUser } from '../utils/adminUsers'

interface Report {
  message: string
  failures: string[]
}

type Translate = (key: TranslationKey, ...args: unknown[]) => string

/** Le texte de la confirmation récapitulative d'une action en lot : une seule boîte pour toute la sélection. */
function confirmFor(action: BulkAction, count: number, names: string, quizTitle: string, t: Translate): ConfirmOptions {
  switch (action) {
    case 'disable': return { title: t('usersBulk.disableTitle', count), message: t('usersBulk.disableConfirm', names), confirmLabel: t('usersBulk.disableLabel'), destructive: true }
    case 'enable': return { title: t('usersBulk.enableTitle', count), message: t('usersBulk.enableConfirm', names), confirmLabel: t('usersBulk.enableLabel') }
    case 'grant': return { title: t('usersBulk.grantTitle', count), message: t('usersBulk.grantConfirm', names, quizTitle), confirmLabel: t('usersBulk.grantLabel') }
    case 'revoke': return { title: t('usersBulk.revokeTitle', count), message: t('usersBulk.revokeConfirm', names, quizTitle), confirmLabel: t('usersBulk.revokeLabel'), destructive: true }
  }
}

function doneMessage(action: BulkAction, count: number, quizTitle: string, t: Translate): string {
  switch (action) {
    case 'disable': return t('usersBulk.doneDisabled', count)
    case 'enable': return t('usersBulk.doneEnabled', count)
    case 'grant': return t('usersBulk.doneGranted', count, quizTitle)
    case 'revoke': return t('usersBulk.doneRevoked', count, quizTitle)
  }
}

interface UsersBulkBarProps {
  /** Les utilisateurs sélectionnés ET affichés : une sélection que les filtres cachent ne reçoit aucune action. */
  selected: AdminUser[]
  /** Après une action : les identifiants de ceux pour qui elle a réussi (la liste se recharge, ils sortent de la sélection). */
  onDone: (doneIds: string[]) => void | Promise<void>
  onClear: () => void
}

/** Les actions en lot de la liste des utilisateurs : désactiver, réactiver, accorder ou retirer l'accès à un quiz. Une seule confirmation
 * récapitulative, puis chaque compte est traité à part par les mêmes fonctions que la fiche : mêmes garde-fous (son propre compte, le
 * dernier administrateur actif), une ligne de journal par utilisateur. Un refus n'arrête pas les autres et est rapporté avec sa raison. */
export function UsersBulkBar({ selected, onDone, onClear }: UsersBulkBarProps) {
  const { t } = useTranslation()
  const [quizzes, setQuizzes] = useState<HostedQuizSummary[] | null>(null)
  const [quizError, setQuizError] = useState(false)
  const [quizId, setQuizId] = useState('')
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<Report | null>(null)
  const hasSelection = selected.length > 0

  // La liste des quiz n'est lue qu'une fois, à la première sélection : inutile tant que personne n'est coché.
  useEffect(() => {
    if (!hasSelection || quizzes !== null) return
    fetchAccessibleQuizzes().then(setQuizzes).catch(() => setQuizError(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSelection])

  // Un quiz public est ouvert à tous : lui accorder un accès n'aurait aucun effet.
  const privateQuizzes = (quizzes ?? []).filter((quiz) => !quiz.is_public)
  const chosenQuiz = privateQuizzes.find((quiz) => quiz.id === quizId)

  const act = async (action: BulkAction) => {
    setReport(null)
    const needsQuiz = action === 'grant' || action === 'revoke'
    if (needsQuiz && !chosenQuiz) return
    const plan = planBulk(action, selected)
    if (plan.targets.length === 0) { setReport({ message: t('usersBulk.nothingToDo'), failures: [] }); return }

    const { names, more } = namesPreview(plan.targets)
    const list = more > 0 ? t('usersBulk.moreNames', names, more) : names
    const already = plan.skipped.filter((item) => item.reason === 'already').length
    const notes = [plan.skipped.some((item) => item.reason === 'self') ? t('usersBulk.skippedSelf') : '', already > 0 ? t('usersBulk.skippedAlready', already) : ''].filter(Boolean).join(' ')
    const options = confirmFor(action, plan.targets.length, list, chosenQuiz?.title ?? '', t)
    if (!(await confirmDialog({ ...options, message: notes ? `${options.message} ${notes}` : options.message }))) return

    setBusy(true)
    try {
      const result: BulkResult = await runBulk(plan.targets, (user) => {
        if (action === 'disable') return setUserDisabled(user.user_id, true)
        if (action === 'enable') return setUserDisabled(user.user_id, false)
        return setUserQuizAccess(user.user_id, chosenQuiz!.id, action === 'grant')
      })
      setReport({
        message: result.done.length > 0 ? doneMessage(action, result.done.length, chosenQuiz?.title ?? '', t) : '',
        failures: result.failed.map(({ user, failure }) => t('usersBulk.failedLine', user.pseudo, t(USER_ACTION_ERROR_KEYS[failure]))),
      })
      // Les actions ont eu lieu : si la liste ne se recharge pas, ce n'est pas un échec de l'action.
      await Promise.resolve(onDone(result.done.map((user) => user.user_id))).catch(() => {})
    } finally {
      setBusy(false)
    }
  }

  if (!hasSelection && !report) return null

  return <section className="users-bulk" aria-label={t('usersBulk.selected', selected.length)}>
    {hasSelection && <>
      <div className="users-bulk-row">
        <strong className="users-bulk-count">{t('usersBulk.selected', selected.length)}</strong>
        <button type="button" className="secondary" disabled={busy} onClick={() => act('disable')}>{t('usersBulk.disable')}</button>
        <button type="button" className="secondary" disabled={busy} onClick={() => act('enable')}>{t('usersBulk.enable')}</button>
        <button type="button" className="secondary users-bulk-clear" disabled={busy} onClick={onClear}>{t('usersBulk.clear')}</button>
      </div>
      <div className="users-bulk-row">
        <label className="users-bulk-quiz">{t('usersBulk.quizLabel')}
          <select value={quizId} onChange={(event) => setQuizId(event.target.value)} disabled={busy || quizzes === null}>
            <option value="">{t('usersBulk.quizPlaceholder')}</option>
            {privateQuizzes.map((quiz) => <option key={quiz.id} value={quiz.id}>{quiz.title}</option>)}
          </select>
        </label>
        <button type="button" className="secondary" disabled={busy || !chosenQuiz} onClick={() => act('grant')}>{t('usersBulk.grant')}</button>
        <button type="button" className="secondary" disabled={busy || !chosenQuiz} onClick={() => act('revoke')}>{t('usersBulk.revoke')}</button>
      </div>
      {quizError && <p className="alert" role="alert">{t('usersBulk.quizLoadError')}</p>}
    </>}
    {report && <div className="users-bulk-report" role="status">
      {report.message && <p className="profile-saved">{report.message}</p>}
      {report.failures.length > 0 && <>
        <p className="users-bulk-failed">{t('usersBulk.failedTitle', report.failures.length)}</p>
        <ul>{report.failures.map((line) => <li key={line}>{line}</li>)}</ul>
      </>}
    </div>}
  </section>
}
