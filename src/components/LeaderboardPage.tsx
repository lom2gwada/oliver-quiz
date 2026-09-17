import { useEffect, useState } from 'react'
import type { GameMode, Quiz } from '../types/quiz'
import type { LeaderboardRow, OverallLeaderboardRow, StreakLeaderboardRow, TimedLeaderboardRow } from '../types/leaderboard'
import { useTranslation } from '../i18n'
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
  hostedQuizId: string
  initialMode?: GameMode
  onBack: () => void
}

/** Les vues *_leaderboard affichent déjà le titre courant du quiz (jointure live sur `quizzes`, cf.
 * `021_history_quiz_id.sql`) — seule la clé de regroupement/filtrage doit préférer l'id, insensible à un
 * renommage, avec repli sur le titre pour les lignes d'un quiz depuis supprimé. */
const quizKeyOf = (row: { quiz_id: string | null; quiz_title: string }) => row.quiz_id ?? row.quiz_title

export function LeaderboardPage({ quiz, hostedQuizId, initialMode = 'classic', onBack }: LeaderboardPageProps) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<LeaderboardTab>(initialMode)
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null)
  const [streakRows, setStreakRows] = useState<StreakLeaderboardRow[] | null>(null)
  const [timedRows, setTimedRows] = useState<TimedLeaderboardRow[] | null>(null)
  const [overallRows, setOverallRows] = useState<OverallLeaderboardRow[] | null>(null)
  const [error, setError] = useState('')
  const [selectedQuiz, setSelectedQuiz] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    fetchLeaderboard().then(setRows).catch(() => setError(t('leaderboard.errorLoad')))
    fetchStreakLeaderboard().then(setStreakRows).catch(() => {})
    fetchTimedLeaderboard().then(setTimedRows).catch(() => {})
    fetchOverallLeaderboard().then(setOverallRows).catch(() => {})
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null))
  }, [])

  const activeRows = mode === 'classic' ? rows : mode === 'streak' ? streakRows : mode === 'timed' ? timedRows : overallRows
  const quizKeys = activeRows ? Array.from(new Set(activeRows.map(quizKeyOf))) : []
  const keyLabels = new Map((activeRows ?? []).map((row) => [quizKeyOf(row), row.quiz_title]))
  const activeQuizKey = hostedQuizId || quiz.metadata.title
  const activeQuiz = selectedQuiz && quizKeys.includes(selectedQuiz) ? selectedQuiz : (quizKeys.includes(activeQuizKey) ? activeQuizKey : quizKeys[0])

  // Chaque vue est déjà triée côté base, mais le tri global (toutes parties confondues) ne correspond pas
  // forcément au top 10 d'un quiz une fois filtré sur `activeQuiz` — d'où ce re-tri après filtrage.
  const displayRows: DisplayRow[] =
    mode === 'classic'
      ? (rows ?? []).filter((row) => quizKeyOf(row) === activeQuiz)
        .sort((a, b) => b.best_score - a.best_score || b.earned_points - a.earned_points || a.elapsed_seconds - b.elapsed_seconds)
        .slice(0, MAX_ROWS)
        .map((row) => ({
          userId: row.user_id, pseudo: row.pseudo, avatar: row.avatar,
          details: t('leaderboard.detailsClassic', row.earned_points, row.total_points, row.question_count, formatDuration(row.elapsed_seconds)),
          score: `${row.best_score}%`,
        }))
      : mode === 'streak'
        ? (streakRows ?? []).filter((row) => quizKeyOf(row) === activeQuiz)
          .sort((a, b) => b.best_streak - a.best_streak || Number(b.victory) - Number(a.victory) || a.elapsed_seconds - b.elapsed_seconds)
          .slice(0, MAX_ROWS)
          .map((row) => ({
            userId: row.user_id, pseudo: row.pseudo, avatar: row.avatar,
            details: t('leaderboard.detailsStreak', row.themes.join(', ') || t('common.allThemes'), formatDuration(row.elapsed_seconds)),
            score: `${row.victory ? '🏆' : '🔥'} ${row.best_streak}`,
          }))
        : mode === 'timed'
          ? (timedRows ?? []).filter((row) => quizKeyOf(row) === activeQuiz)
            .sort((a, b) => (b.pace_per_minute ?? -1) - (a.pace_per_minute ?? -1) || b.correct_count - a.correct_count)
            .slice(0, MAX_ROWS)
            .map((row) => ({
              userId: row.user_id, pseudo: row.pseudo, avatar: row.avatar,
              details: t('leaderboard.detailsTimed', row.correct_count, row.question_count, row.duration_seconds === 0 ? t('common.unlimited') : t('common.minutesShort', Math.round(row.duration_seconds / 60)), formatDuration(row.elapsed_seconds)),
              score: row.pace_per_minute !== null ? `${row.pace_per_minute}/min` : '—',
            }))
          : (overallRows ?? []).filter((row) => quizKeyOf(row) === activeQuiz)
            .sort((a, b) => b.total_correct - a.total_correct || (b.success_rate ?? -1) - (a.success_rate ?? -1))
            .slice(0, MAX_ROWS)
            .map((row) => ({
              userId: row.user_id, pseudo: row.pseudo, avatar: row.avatar,
              details: t('leaderboard.detailsOverall', row.total_attempted, row.games_played, row.success_rate ?? 0),
              score: `✓ ${row.total_correct}`,
            }))

  return <section className="stats-page">
    <div className="stats-header">
      <h2>{t('leaderboard.title')}</h2>
      <button type="button" className="secondary" onClick={onBack}>{t('common.back')}</button>
    </div>
    <div className="mode-picker" role="group" aria-label={t('start.modeGroupLabel')}>
      <button type="button" className={mode === 'classic' ? 'mode-option active' : 'mode-option'} onClick={() => setMode('classic')}>{t('common.modeClassic')}</button>
      <button type="button" className={mode === 'streak' ? 'mode-option active' : 'mode-option'} onClick={() => setMode('streak')}>{t('common.modeStreak')}</button>
      <button type="button" className={mode === 'timed' ? 'mode-option active' : 'mode-option'} onClick={() => setMode('timed')}>{t('common.modeTimed')}</button>
      <button type="button" className={mode === 'overall' ? 'mode-option active' : 'mode-option'} onClick={() => setMode('overall')}>{t('leaderboard.modeOverall')}</button>
    </div>
    {error && mode === 'classic' && <p className="alert" role="alert">{error}</p>}
    {!activeRows && <p>{t('common.loading')}</p>}
    {activeRows && !activeRows.length && <p>{t('leaderboard.emptyState', mode !== 'classic')}</p>}
    {quizKeys.length > 0 && <label className="quiz-select">{t('start.quizLabel')}
      <select value={activeQuiz} onChange={(event) => setSelectedQuiz(event.target.value)}>
        {quizKeys.map((key) => <option key={key} value={key}>{keyLabels.get(key)}</option>)}
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
