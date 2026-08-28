import { useEffect, useState } from 'react'
import type { Quiz } from '../types/quiz'
import type { LeaderboardRow } from '../types/leaderboard'
import { fetchLeaderboard } from '../utils/leaderboard'
import { supabase } from '../utils/supabase'
import { formatDuration } from '../utils/time'

const RANK_MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }
const MAX_ROWS = 10

interface LeaderboardPageProps {
  quiz: Quiz
  onBack: () => void
}

export function LeaderboardPage({ quiz, onBack }: LeaderboardPageProps) {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null)
  const [error, setError] = useState('')
  const [selectedQuiz, setSelectedQuiz] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    fetchLeaderboard().then(setRows).catch(() => setError('Impossible de charger le classement.'))
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null))
  }, [])

  const quizTitles = rows ? Array.from(new Set(rows.map((row) => row.quiz_title))) : []
  const activeQuiz = selectedQuiz && quizTitles.includes(selectedQuiz) ? selectedQuiz : (quizTitles.includes(quiz.metadata.title) ? quiz.metadata.title : quizTitles[0])
  const ranked = rows ? rows.filter((row) => row.quiz_title === activeQuiz).sort((a, b) =>
    b.best_score - a.best_score || b.earned_points - a.earned_points || a.elapsed_seconds - b.elapsed_seconds).slice(0, MAX_ROWS) : []

  return <section className="stats-page">
    <div className="stats-header">
      <h2>Classement</h2>
      <button type="button" className="secondary" onClick={onBack}>Retour</button>
    </div>
    {error && <p className="alert" role="alert">{error}</p>}
    {!error && !rows && <p>Chargement…</p>}
    {rows && !rows.length && <p>Aucun score enregistré pour l'instant.</p>}
    {quizTitles.length > 1 && <label className="quiz-select">Quiz
      <select value={activeQuiz} onChange={(event) => setSelectedQuiz(event.target.value)}>
        {quizTitles.map((title) => <option key={title} value={title}>{title}</option>)}
      </select>
    </label>}
    {ranked.length > 0 && <ol className="leaderboard-list">
      {ranked.map((row, index) => <li className={`leaderboard-item${row.user_id === currentUserId ? ' leaderboard-item-self' : ''}`} key={row.user_id}>
        <span className="leaderboard-rank">{RANK_MEDALS[index + 1] ?? index + 1}</span>
        <span className="leaderboard-avatar">{row.avatar}</span>
        <div className="leaderboard-main">
          <span className="leaderboard-pseudo">{row.pseudo}</span>
          <span className="leaderboard-details">{row.earned_points}/{row.total_points} pts · {row.question_count} question{row.question_count > 1 ? 's' : ''} · ⏱ {formatDuration(row.elapsed_seconds)}</span>
        </div>
        <span className="leaderboard-score">{row.best_score}%</span>
      </li>)}
    </ol>}
  </section>
}
