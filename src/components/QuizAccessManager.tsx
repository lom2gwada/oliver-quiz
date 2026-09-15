import { useEffect, useState } from 'react'
import type { HostedQuizSummary } from '../types/hostedQuiz'
import { fetchAccessGrants, fetchAllProfiles, grantAccess, revokeAccess, type ProfileSummary } from '../utils/hostedQuizzes'

/** Admin uniquement : qui a accès à ce quiz hébergé. Optimiste (coche/décoche tout de suite) avec
 * resynchronisation depuis la base si l'appel réseau échoue, pour ne jamais laisser un état affiché
 * incohérent avec ce qui est réellement enregistré. */
export function QuizAccessManager({ quiz }: { quiz: HostedQuizSummary }) {
  const [profiles, setProfiles] = useState<ProfileSummary[]>([])
  const [grantedIds, setGrantedIds] = useState<string[]>([])

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

  return <div className="quiz-access-list">
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
