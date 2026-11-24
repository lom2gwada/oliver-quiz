import { useEffect, useState } from 'react'
import type { HostedQuizSummary } from '../types/hostedQuiz'
import { useTranslation } from '../i18n'
import { fetchAccessGrants, fetchAllProfiles, grantAccess, revokeAccess, setQuizPublic, type ProfileSummary } from '../utils/hostedQuizzes'
import { classifyQuizAdminError, fetchQuizAccessUsers, QUIZ_ADMIN_ERROR_KEYS, type QuizAccessUser } from '../utils/quizAdmins'
import { QuizUserSearch } from './QuizUserSearch'

interface QuizAccessManagerProps {
  quiz: HostedQuizSummary
  onTogglePublic: (isPublic: boolean) => void
  /** L'administrateur global voit tous les comptes et les coche ; un administrateur de quiz les retrouve par pseudo (il ne lit pas `profiles`). */
  isGlobalAdmin: boolean
  /** Seuls les propriétaires (et l'administrateur global) peuvent rendre le quiz public. */
  isOwner: boolean
}

/** Qui a accès à ce quiz hébergé, plus la bascule « visible par tous par défaut » (`is_public`, cf. `020_public_quizzes.sql`),
 * réservée aux propriétaires. Optimiste (coche/décoche tout de suite) avec resynchronisation depuis la base si l'appel réseau
 * échoue, pour ne jamais laisser un état affiché incohérent avec ce qui est réellement enregistré. */
export function QuizAccessManager({ quiz, onTogglePublic, isGlobalAdmin, isOwner }: QuizAccessManagerProps) {
  const { t } = useTranslation()
  const [profiles, setProfiles] = useState<ProfileSummary[]>([])
  const [grantedIds, setGrantedIds] = useState<string[]>([])
  const [publicError, setPublicError] = useState('')

  useEffect(() => { if (isGlobalAdmin) fetchAllProfiles().then(setProfiles).catch(() => {}) }, [isGlobalAdmin])
  useEffect(() => { if (isGlobalAdmin) fetchAccessGrants(quiz.id).then(setGrantedIds).catch(() => {}) }, [quiz.id, isGlobalAdmin])

  const toggle = async (userId: string) => {
    const hasAccess = grantedIds.includes(userId)
    setGrantedIds((previous) => hasAccess ? previous.filter((id) => id !== userId) : [...previous, userId])
    try {
      if (hasAccess) await revokeAccess(quiz.id, userId)
      else await grantAccess(quiz.id, userId)
    } catch {
      fetchAccessGrants(quiz.id).then(setGrantedIds).catch(() => {})
    }
  }

  const togglePublic = async () => {
    const next = !quiz.is_public
    setPublicError('')
    onTogglePublic(next)
    try {
      await setQuizPublic(quiz.id, next)
    } catch {
      onTogglePublic(!next)
      setPublicError(t('admin.errorTogglePublic'))
    }
  }

  return <div className="quiz-access-list">
    <label className="theme-checkbox">
      <input type="checkbox" checked={quiz.is_public} onChange={togglePublic} disabled={!isOwner} />
      {t('admin.publicQuizLabel')}
    </label>
    {!isOwner && <p className="mode-hint">{t('admin.publicOwnerOnly')}</p>}
    {publicError && <p className="alert" role="alert">{publicError}</p>}
    {quiz.is_public ? <p className="mode-hint">{t('admin.publicQuizHint')}</p> : isGlobalAdmin ? <div className="quiz-access-item">
      <div className="quiz-access-users">
        {profiles.map((profile) => <label key={profile.id} className="theme-checkbox">
          <input type="checkbox" checked={grantedIds.includes(profile.id)} onChange={() => toggle(profile.id)} />
          {profile.avatar} {profile.pseudo}
        </label>)}
      </div>
    </div> : <ScopedAccess quizId={quiz.id} />}
  </div>
}

/** Pour un administrateur de quiz qui n'est pas administrateur global : les comptes qui ont accès, à retirer, et une recherche par
 * pseudo pour en ajouter. */
function ScopedAccess({ quizId }: { quizId: string }) {
  const { t } = useTranslation()
  const [users, setUsers] = useState<QuizAccessUser[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const failure = (cause: unknown) => t(QUIZ_ADMIN_ERROR_KEYS[classifyQuizAdminError(cause instanceof Error ? cause.message : (cause as { message?: string } | null)?.message)])

  const load = () => fetchQuizAccessUsers(quizId).then(setUsers).catch((cause) => setError(failure(cause)))
  useEffect(() => { setUsers(null); setError(''); load() }, [quizId])

  const setAccess = async (userId: string, granted: boolean) => {
    setBusy(true); setError('')
    try {
      if (granted) await grantAccess(quizId, userId)
      else await revokeAccess(quizId, userId)
      await load()
      setRefreshKey((key) => key + 1)
    } catch (cause) {
      setError(failure(cause))
      await load()
    } finally { setBusy(false) }
  }

  return <div className="quiz-access-item">
    <h4>{t('quizAdmin.accessListTitle')}</h4>
    {users && (users.length === 0
      ? <p className="mode-hint">{t('quizAdmin.accessNone')}</p>
      : <ul className="quiz-user-results">
        {users.map((user) => <li key={user.user_id}>
          <span className="quiz-user-name">{user.avatar} {user.pseudo}</span>
          <button type="button" className="secondary" disabled={busy} onClick={() => setAccess(user.user_id, false)}>{t('quizAdmin.revokeAccess')}</button>
        </li>)}
      </ul>)}
    {error && <p className="alert" role="alert">{error}</p>}
    <QuizUserSearch
      quizId={quizId}
      refreshKey={refreshKey}
      renderAction={(match) => match.has_access
        ? <span className="quiz-admin-tag">{t('quizAdmin.hasAccess')}</span>
        : <button type="button" className="secondary" disabled={busy} onClick={() => setAccess(match.user_id, true)}>{t('quizAdmin.grantAccess')}</button>}
    />
  </div>
}
