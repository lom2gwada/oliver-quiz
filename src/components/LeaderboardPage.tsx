import { useEffect, useState } from 'react'
import type { GameMode, Quiz } from '../types/quiz'
import type { LeaderboardRow, OverallLeaderboardRow, StreakLeaderboardRow, TimedLeaderboardRow } from '../types/leaderboard'
import { useTranslation } from '../i18n'
import type { Language, TranslationKey } from '../i18n'
import { fetchLeaderboard, fetchOverallLeaderboard, fetchStreakLeaderboard, fetchTimedLeaderboard } from '../utils/leaderboard'
import { supabase } from '../utils/supabase'
import { longDate } from '../utils/dateFormat'
import { formatNumber, formatPercent } from '../utils/format'
import { formatDuration } from '@engine/utils/time'
import { buildQuizOptions } from '../utils/quizOptions'
import { timedDurationLabel } from '../utils/timedDuration'

const RANK_MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }
const MAX_ROWS = 10

type LeaderboardTab = GameMode | 'overall'

interface DisplayRow {
  userId: string
  pseudo: string
  avatar: string
  details: string
  /** Date de la partie retenue (ou de la dernière partie, pour « Général »), déjà formatée. */
  date: string
  /** Valeur mise en avant à droite, et ce qu'elle mesure — le sens change selon le mode (bonnes réponses, série, rythme). */
  score: string
  scoreLabel: string
  /** Infobulle de la ligne de détails. */
  detailsHint: string
}

interface LeaderboardPageProps {
  quiz: Quiz
  hostedQuizId: string
  /** Les quiz auxquels le joueur a accès : la liste du sélecteur est la même que celle de l'historique. */
  hostedQuizzes: { id: string; title: string }[]
  initialMode?: GameMode
  /** Quiz à afficher d'emblée quand on arrive depuis la page d'historique (qui peut montrer un autre quiz que
   * le quiz actif) ; ajouté au sélecteur même sans partie classée, pour ne pas retomber sur un autre quiz. */
  focusQuiz?: { key: string; label: string } | null
  onViewOverview: () => void
  onBack: () => void
}

/** Les vues *_leaderboard affichent déjà le titre courant du quiz (jointure live sur `quizzes`, cf.
 * `021_history_quiz_id.sql`) — seule la clé de regroupement/filtrage doit préférer l'id, insensible à un
 * renommage, avec repli sur le titre pour les lignes d'un quiz depuis supprimé. */
const quizKeyOf = (row: { quiz_id: string | null; quiz_title: string }) => row.quiz_id ?? row.quiz_title

/** Rythme et points ne sont pas connus pour les parties jouées avant l'introduction de ces colonnes
 * (`025_points_and_pace_everywhere.sql`) — un tiret plutôt qu'un 0 trompeur. */
type Translate = (key: TranslationKey, ...args: unknown[]) => string
const paceLabel = (pace: number | null, t: Translate, language: Language) => (pace !== null ? t('metric.paceValue', formatNumber(pace, language)) : '—')
const pointsLabel = (points: number | null) => (points !== null ? `${points} pts` : '—')
/** « 52 pts (74 % des points) » : le pourcentage est la part des points, pas celle des bonnes réponses. */
const pointsSummary = (earned: number | null, total: number | null, t: Translate, language: Language) =>
  earned === null ? '—' : total ? `${earned} pts (${t('metric.pointsShare', formatPercent(Math.round((earned / total) * 100), language))})` : `${earned} pts`

export function LeaderboardPage({ quiz, hostedQuizId, hostedQuizzes, initialMode = 'classic', focusQuiz = null, onViewOverview, onBack }: LeaderboardPageProps) {
  const { t, language } = useTranslation()
  const [mode, setMode] = useState<LeaderboardTab>(initialMode)
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null)
  const [streakRows, setStreakRows] = useState<StreakLeaderboardRow[] | null>(null)
  const [timedRows, setTimedRows] = useState<TimedLeaderboardRow[] | null>(null)
  const [overallRows, setOverallRows] = useState<OverallLeaderboardRow[] | null>(null)
  const [error, setError] = useState('')
  const [selectedQuiz, setSelectedQuiz] = useState<string | null>(focusQuiz?.key ?? null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    fetchLeaderboard().then(setRows).catch(() => setError(t('leaderboard.errorLoad')))
    fetchStreakLeaderboard().then(setStreakRows).catch(() => {})
    fetchTimedLeaderboard().then(setTimedRows).catch(() => {})
    fetchOverallLeaderboard().then(setOverallRows).catch(() => {})
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null))
  }, [])

  const activeRows = mode === 'classic' ? rows : mode === 'streak' ? streakRows : mode === 'timed' ? timedRows : overallRows

  // Le sélecteur de quiz est celui de l'historique (voir `buildQuizOptions`) : les quiz accessibles, plus ceux dont une
  // ligne existe encore dans N'IMPORTE QUEL mode (pas seulement le mode actif — sinon changer d'onglet faisait disparaître
  // le quiz choisi), plus le quiz actif, même sans aucune partie classée : les vues du classement ne retiennent que les
  // parties sans filtre, donc un quiz joué uniquement avec des filtres en serait absent. Le quiz choisi reste le même en
  // changeant d'onglet ; s'il n'a pas de partie dans ce mode, `displayRows` sera simplement vide.
  const allSources = [rows, streakRows, timedRows, overallRows]
  const activeQuizKey = hostedQuizId || quiz.metadata.title
  const seen = [...(focusQuiz ? [focusQuiz] : []), ...allSources.flatMap((source) => (source ?? []).map((row) => ({ key: quizKeyOf(row), label: row.quiz_title })))]
  const quizOptions = buildQuizOptions({ hosted: hostedQuizzes, seen, active: { key: activeQuizKey, label: quiz.metadata.title }, language })
  const quizKeys = quizOptions.map((option) => option.key)
  const activeQuiz = selectedQuiz && quizKeys.includes(selectedQuiz) ? selectedQuiz : activeQuizKey

  // Chaque vue est déjà triée côté base, mais le tri global (toutes parties confondues) ne correspond pas
  // forcément au top 10 d'un quiz une fois filtré sur `activeQuiz` — d'où ce re-tri après filtrage.
  const displayRows: DisplayRow[] =
    mode === 'classic'
      ? (rows ?? []).filter((row) => quizKeyOf(row) === activeQuiz)
        .sort((a, b) => b.correct_count - a.correct_count || b.best_score - a.best_score || b.earned_points - a.earned_points || a.elapsed_seconds - b.elapsed_seconds)
        .slice(0, MAX_ROWS)
        .map((row) => ({
          userId: row.user_id, pseudo: row.pseudo, avatar: row.avatar,
          date: longDate(row.played_at, language),
          details: t('leaderboard.detailsClassic', row.correct_count, row.question_count, pointsSummary(row.earned_points, row.total_points, t, language), paceLabel(row.pace_per_minute, t, language), formatDuration(row.elapsed_seconds)),
          score: `✓ ${row.correct_count}`, scoreLabel: t('leaderboard.scoreCorrect'), detailsHint: t('metric.pointsShareHint'),
        }))
      : mode === 'streak'
        ? (streakRows ?? []).filter((row) => quizKeyOf(row) === activeQuiz)
          .sort((a, b) => b.best_streak - a.best_streak || Number(b.victory) - Number(a.victory) || a.elapsed_seconds - b.elapsed_seconds)
          .slice(0, MAX_ROWS)
          .map((row) => ({
            userId: row.user_id, pseudo: row.pseudo, avatar: row.avatar,
            date: longDate(row.played_at, language),
            details: t('leaderboard.detailsStreak', row.themes.join(', ') || t('common.allThemes'), paceLabel(row.pace_per_minute, t, language), pointsSummary(row.earned_points, row.total_points, t, language), formatDuration(row.elapsed_seconds)),
            score: `${row.victory ? '🏆' : '🔥'} ${row.best_streak}`, scoreLabel: t('leaderboard.scoreStreak'), detailsHint: t('metric.pointsShareHint'),
          }))
        : mode === 'timed'
          ? (timedRows ?? []).filter((row) => quizKeyOf(row) === activeQuiz && row.question_count > 0)
            .sort((a, b) => b.correct_count - a.correct_count || (b.pace_per_minute ?? -1) - (a.pace_per_minute ?? -1))
            .slice(0, MAX_ROWS)
            .map((row) => ({
              userId: row.user_id, pseudo: row.pseudo, avatar: row.avatar,
              date: longDate(row.played_at, language),
              details: t('leaderboard.detailsTimed', row.correct_count, row.question_count, pointsSummary(row.earned_points, row.total_points, t, language), timedDurationLabel(row.elapsed_seconds, row.duration_seconds, t)),
              score: row.pace_per_minute !== null ? formatNumber(row.pace_per_minute, language) : '—', scoreLabel: t('leaderboard.scorePace'), detailsHint: t('metric.pointsShareHint'),
            }))
          : (overallRows ?? []).filter((row) => quizKeyOf(row) === activeQuiz)
            .sort((a, b) => b.total_correct - a.total_correct || (b.success_rate ?? -1) - (a.success_rate ?? -1))
            .slice(0, MAX_ROWS)
            .map((row) => ({
              userId: row.user_id, pseudo: row.pseudo, avatar: row.avatar,
              date: t('leaderboard.lastGame', longDate(row.last_played_at, language)),
              details: t('leaderboard.detailsOverall', row.total_attempted, row.games_played, formatPercent(row.success_rate ?? 0, language), pointsLabel(row.total_earned_points)),
              score: `✓ ${row.total_correct}`, scoreLabel: t('leaderboard.scoreCorrect'), detailsHint: t('metric.successRateHint'),
            }))

  return <section className="stats-page">
    <div className="stats-header">
      <h2>{t('leaderboard.title')}</h2>
      <div className="stats-header-actions">
        <button type="button" className="secondary" onClick={onViewOverview}>{t('nav.overview')}</button>
        <button type="button" className="secondary" onClick={onBack}>{t('common.back')}</button>
      </div>
    </div>
    <div className="mode-picker" role="group" aria-label={t('start.modeGroupLabel')}>
      <button type="button" className={mode === 'classic' ? 'mode-option active' : 'mode-option'} onClick={() => setMode('classic')}>{t('common.modeClassic')}</button>
      <button type="button" className={mode === 'streak' ? 'mode-option active' : 'mode-option'} onClick={() => setMode('streak')}>{t('common.modeStreak')}</button>
      <button type="button" className={mode === 'timed' ? 'mode-option active' : 'mode-option'} onClick={() => setMode('timed')}>{t('common.modeTimed')}</button>
      <button type="button" className={mode === 'overall' ? 'mode-option active' : 'mode-option'} onClick={() => setMode('overall')}>{t('leaderboard.modeOverall')}</button>
    </div>
    {error && mode === 'classic' && <p className="alert" role="alert">{error}</p>}
    {!activeRows && <p>{t('common.loading')}</p>}
    {activeRows && !displayRows.length && <p>{t('leaderboard.emptyState')}</p>}
    {quizKeys.length > 0 && <label className="quiz-select">{t('start.quizLabel')}
      <select value={activeQuiz} onChange={(event) => setSelectedQuiz(event.target.value)}>
        {quizOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
      </select>
    </label>}
    {displayRows.length > 0 && <ol className="leaderboard-list">
      {displayRows.map((row, index) => <li className={`leaderboard-item${row.userId === currentUserId ? ' leaderboard-item-self' : ''}`} key={row.userId}>
        <span className="leaderboard-rank">{RANK_MEDALS[index + 1] ?? index + 1}</span>
        <span className="leaderboard-avatar">{row.avatar}</span>
        <div className="leaderboard-main">
          <span className="leaderboard-pseudo">{row.pseudo} <span className="leaderboard-date">· {row.date}</span></span>
          <span className="leaderboard-details" title={row.detailsHint}>{row.details}</span>
        </div>
        <span className="leaderboard-score"><span>{row.score}</span><span className="leaderboard-score-label">{row.scoreLabel}</span></span>
      </li>)}
    </ol>}
  </section>
}
