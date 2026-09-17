import { useEffect, useState } from 'react'
import type { HostedQuizSummary } from '../types/hostedQuiz'
import { useTranslation } from '../i18n'
import { fetchAccessGrants, fetchAllProfiles, grantAccess, revokeAccess, setQuizPublic, type ProfileSummary } from '../utils/hostedQuizzes'

interface QuizAccessManagerProps {
  quiz: HostedQuizSummary
  onTogglePublic: (isPublic: boolean) => void
}

/** Admin uniquement : qui a accès à ce quiz hébergé, plus le bascule "visible par tous par défaut"
 * (`is_public`, cf. `020_public_quizzes.sql`). Optimiste (coche/décoche tout de suite) avec
 * resynchronisation depuis la base si l'appel réseau échoue, pour ne jamais laisser un état affiché
 * incohérent avec ce qui est réellement enregistré. */
export function QuizAccessManager({ quiz, onTogglePublic }: QuizAccessManagerProps) {
  const { t } = useTranslation()
  const [profiles, setProfiles] = useState<ProfileSummary[]>([])
  const [grantedIds, setGrantedIds] = useState<string[]>([])
  const [publicError, setPublicError] = useState('')

  useEffect(() => { fetchAllProfiles().then(setProfiles).catch(() => {}) }, [])
  useEffect(() => { fetchAccessGrants(quiz.id).then(setGrantedIds).catch(() => {}) }, [quiz.id])

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
      <input type="checkbox" checked={quiz.is_public} onChange={togglePublic} />
      {t('admin.publicQuizLabel')}
    </label>
    <p className="mode-hint">{t('admin.publicQuizHint')}</p>
    {publicError && <p className="alert" role="alert">{publicError}</p>}
    <div className="quiz-access-item">
      <div className="quiz-access-users">
        {profiles.map((profile) => <label key={profile.id} className="theme-checkbox">
          <input type="checkbox" checked={grantedIds.includes(profile.id)} onChange={() => toggle(profile.id)} />
          {profile.avatar} {profile.pseudo}
        </label>)}
      </div>
    </div>
  </div>
}
