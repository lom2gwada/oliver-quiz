import { useEffect, useState } from 'react'
import type { HostedQuizSummary } from '../types/hostedQuiz'
import { useTranslation } from '../i18n'
import { fetchAccessGrants, fetchAllProfiles, grantAccess, revokeAccess, type ProfileSummary } from '../utils/hostedQuizzes'

/** Admin uniquement : qui a accès à quel quiz hébergé. Optimiste (coche/décoche tout de suite) avec
 * resynchronisation depuis la base si l'appel réseau échoue, pour ne jamais laisser un état affiché
 * incohérent avec ce qui est réellement enregistré. */
export function QuizAccessManager({ quizzes }: { quizzes: HostedQuizSummary[] }) {
  const { t } = useTranslation()
  const [profiles, setProfiles] = useState<ProfileSummary[]>([])
  const [grants, setGrants] = useState<Record<string, string[]>>({})

  useEffect(() => { fetchAllProfiles().then(setProfiles).catch(() => {}) }, [])
  useEffect(() => {
    Promise.all(quizzes.map(async (quiz) => [quiz.id, await fetchAccessGrants(quiz.id)] as const))
      .then((entries) => setGrants(Object.fromEntries(entries)))
      .catch(() => {})
  }, [quizzes])

  const toggle = async (quizId: string, userId: string) => {
    const hasAccess = (grants[quizId] ?? []).includes(userId)
    setGrants((previous) => ({
      ...previous,
      [quizId]: hasAccess ? (previous[quizId] ?? []).filter((id) => id !== userId) : [...(previous[quizId] ?? []), userId],
    }))
    try {
      if (hasAccess) await revokeAccess(quizId, userId)
      else await grantAccess(quizId, userId)
    } catch {
      fetchAccessGrants(quizId).then((ids) => setGrants((previous) => ({ ...previous, [quizId]: ids }))).catch(() => {})
    }
  }

  if (!quizzes.length) return <p>{t('admin.noPublishedQuiz')}</p>

  return <div className="quiz-access-list">
    {quizzes.map((quiz) => <div key={quiz.id} className="quiz-access-item">
      <h4>{quiz.title}</h4>
      <div className="quiz-access-users">
        {profiles.map((profile) => <label key={profile.id} className="theme-checkbox">
          <input type="checkbox" checked={(grants[quiz.id] ?? []).includes(profile.id)} onChange={() => toggle(quiz.id, profile.id)} />
          {profile.avatar} {profile.pseudo}
        </label>)}
      </div>
    </div>)}
  </div>
}
