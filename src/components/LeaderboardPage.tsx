import { useEffect, useState } from 'react'
import type { GameMode, Quiz } from '../types/quiz'
import type { LeaderboardRow, OverallLeaderboardRow, StreakLeaderboardRow, TimedLeaderboardRow } from '../types/leaderboard'
import { fetchLeaderboard, fetchOverallLeaderboard, fetchStreakLeaderboard, fetchTimedLeaderboard } from '../utils/leaderboard'
import { supabase } from '../utils/supabase'
import { formatDuration } from '../utils/time'

const RANK_MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }
const MAX_ROWS = 10

type LeaderboardTab = GameMode | 'overall'

interface DisplayRow {
  userId: string
  pseudo: string
  avatar: string
  details: string
  score: string
}

interface LeaderboardPageProps {
  quiz: Quiz
  initialMode?: GameMode
  onBack: () => void
}

export function LeaderboardPage({ quiz, initialMode = 'classic', onBack }: LeaderboardPageProps) {
  const [mode, setMode] = useState<LeaderboardTab>(initialMode)
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null)
  const [streakRows, setStreakRows] = useState<StreakLeaderboardRow[] | null>(null)
  const [timedRows, setTimedRows] = useState<TimedLeaderboardRow[] | null>(null)
  const [overallRows, setOverallRows] = useState<OverallLeaderboardRow[] | null>(null)
  const [error, setError] = useState('')
  const [selectedQuiz, setSelectedQuiz] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    fetchLeaderboard().then(setRows).catch(() => setError('Impossible de charger le classement.'))
    fetchStreakLeaderboard().then(setStreakRows).catch(() => {})
    fetchTimedLeaderboard().then(setTimedRows).catch(() => {})
    fetchOverallLeaderboard().then(setOverallRows).catch(() => {})
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null))
  }, [])

  const activeRows = mode === 'classic' ? rows : mode === 'streak' ? streakRows : mode === 'timed' ? timedRows : overallRows
  const quizTitles = activeRows ? Array.from(new Set(activeRows.map((row) => row.quiz_title))) : []
  const activeQuiz = selectedQuiz && quizTitles.includes(selectedQuiz) ? selectedQuiz : (quizTitles.includes(quiz.metadata.title) ? quiz.metadata.title : quizTitles[0])

  // Chaque vue est déjà triée côté base, mais le tri global (toutes parties confondues) ne correspond pas
  // forcément au top 10 d'un quiz une fois filtré sur `activeQuiz` — d'où ce re-tri après filtrage.
  const displayRows: DisplayRow[] =
    mode === 'classic'
      ? (rows ?? []).filter((row) => row.quiz_title === activeQuiz)
        .sort((a, b) => b.best_score - a.best_score || b.earned_points - a.earned_points || a.elapsed_seconds - b.elapsed_seconds)
        .slice(0, MAX_ROWS)
        .map((row) => ({
          userId: row.user_id, pseudo: row.pseudo, avatar: row.avatar,
          details: `${row.earned_points}/${row.total_points} pts · ${row.question_count} question${row.question_count > 1 ? 's' : ''} · ⏱ ${formatDuration(row.elapsed_seconds)}`,
          score: `${row.best_score}%`,
        }))
      : mode === 'streak'
        ? (streakRows ?? []).filter((row) => row.quiz_title === activeQuiz)
          .sort((a, b) => b.best_streak - a.best_streak || Number(b.victory) - Number(a.victory) || a.elapsed_seconds - b.elapsed_seconds)
          .slice(0, MAX_ROWS)
          .map((row) => ({
            userId: row.user_id, pseudo: row.pseudo, avatar: row.avatar,
            details: `${row.themes.join(', ') || 'Tous les thèmes'} · ⏱ ${formatDuration(row.elapsed_seconds)}`,
            score: `${row.victory ? '🏆' : '🔥'} ${row.best_streak}`,
          }))
        : mode === 'timed'
          ? (timedRows ?? []).filter((row) => row.quiz_title === activeQuiz)
            .sort((a, b) => (b.pace_per_minute ?? -1) - (a.pace_per_minute ?? -1) || b.correct_count - a.correct_count)
            .slice(0, MAX_ROWS)
            .map((row) => ({
              userId: row.user_id, pseudo: row.pseudo, avatar: row.avatar,
              details: `${row.correct_count}/${row.question_count} · ${row.duration_seconds === 0 ? 'Infini' : `${Math.round(row.duration_seconds / 60)} min`} · ⏱ ${formatDuration(row.elapsed_seconds)}`,
              score: row.pace_per_minute !== null ? `${row.pace_per_minute}/min` : '—',
            }))
          : (overallRows ?? []).filter((row) => row.quiz_title === activeQuiz)
            .sort((a, b) => b.total_correct - a.total_correct || (b.success_rate ?? -1) - (a.success_rate ?? -1))
            .slice(0, MAX_ROWS)
            .map((row) => ({
              userId: row.user_id, pseudo: row.pseudo, avatar: row.avatar,
              details: `${row.total_attempted} tentées · ${row.games_played} partie${row.games_played > 1 ? 's' : ''} · ${row.success_rate ?? 0}% de réussite`,
              score: `✓ ${row.total_correct}`,
            }))

  return <section className="stats-page">
    <div className="stats-header">
      <h2>Classement</h2>
      <button type="button" className="secondary" onClick={onBack}>Retour</button>
    </div>
    <div className="mode-picker" role="group" aria-label="Mode de jeu">
      <button type="button" className={mode === 'classic' ? 'mode-option active' : 'mode-option'} onClick={() => setMode('classic')}>🎯 Classique</button>
      <button type="button" className={mode === 'streak' ? 'mode-option active' : 'mode-option'} onClick={() => setMode('streak')}>🔥 Sans-faute</button>
      <button type="button" className={mode === 'timed' ? 'mode-option active' : 'mode-option'} onClick={() => setMode('timed')}>⏱️ Contre-la-montre</button>
      <button type="button" className={mode === 'overall' ? 'mode-option active' : 'mode-option'} onClick={() => setMode('overall')}>🏅 Général</button>
    </div>
    {error && mode === 'classic' && <p className="alert" role="alert">{error}</p>}
    {!activeRows && <p>Chargement…</p>}
    {activeRows && !activeRows.length && <p>Aucun score enregistré pour l'instant{mode !== 'classic' ? ' dans ce mode' : ''}.</p>}
    {quizTitles.length > 0 && <label className="quiz-select">Quiz
      <select value={activeQuiz} onChange={(event) => setSelectedQuiz(event.target.value)}>
        {quizTitles.map((title) => <option key={title} value={title}>{title}</option>)}
      </select>
    </label>}
    {displayRows.length > 0 && <ol className="leaderboard-list">
      {displayRows.map((row, index) => <li className={`leaderboard-item${row.userId === currentUserId ? ' leaderboard-item-self' : ''}`} key={row.userId}>
        <span className="leaderboard-rank">{RANK_MEDALS[index + 1] ?? index + 1}</span>
        <span className="leaderboard-avatar">{row.avatar}</span>
        <div className="leaderboard-main">
          <span className="leaderboard-pseudo">{row.pseudo}</span>
          <span className="leaderboard-details">{row.details}</span>
        </div>
        <span className="leaderboard-score">{row.score}</span>
      </li>)}
    </ol>}
  </section>
}
