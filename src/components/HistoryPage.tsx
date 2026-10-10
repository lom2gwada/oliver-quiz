import { useEffect, useState } from 'react'
import type { Difficulty, Question, Quiz } from '../types/quiz'
import type { QuizResultRow, StreakResultRow, TimedResultRow } from '../types/history'
import { useTranslation } from '../i18n'
import { bucketsToChartGroups, bucketsToRadarAxes, computeRecords, computeThemeWeekHeatmap, fetchQuizHistory, fetchStreakHistory, fetchTimedHistory, sumBuckets } from '../utils/quizHistory'
import { computeDueQuestions, fetchQuestionProgress, type QuestionProgressRow } from '../utils/leitner'
import { longDate, shortDate } from '../utils/dateFormat'
import { formatDuration } from '../utils/time'
import { PieChart } from './PieChart'
import { RadarChart } from './RadarChart'
import { difficultyLabel, typeLabel } from './QuizPage'
import { ScoreChart } from './ScoreChart'
import { ThemeHeatmap } from './ThemeHeatmap'

/** Tailles de lot proposées pour "Reprendre mes erreurs" — au-delà de quelques dizaines de questions
 * accumulées, tout reprendre d'un coup n'est plus une session de pratique digeste. */
const REPLAY_COUNTS = [10, 20, 30, 50]

interface HistoryPageProps {
  onBack: () => void
  quiz: Quiz
  hostedQuizId: string
  onReviewDue: (questions: Question[]) => void
}

/** Une ligne d'historique "appartient" à `quiz_id` si connu, ou à son titre figé sinon (parties d'avant cette
 * colonne, ou quiz source supprimé depuis) — regroupe ainsi deux titres successifs d'un même quiz renommé
 * plutôt que de les traiter comme deux quiz différents. */
const quizKeyOf = (row: { quiz_id: string | null; quiz_title: string }) => row.quiz_id ?? row.quiz_title

export function HistoryPage({ onBack, quiz, hostedQuizId, onReviewDue }: HistoryPageProps) {
  const { t, language } = useTranslation()
  const [rows, setRows] = useState<QuizResultRow[] | null>(null)
  const [streakRows, setStreakRows] = useState<StreakResultRow[]>([])
  const [timedRows, setTimedRows] = useState<TimedResultRow[]>([])
  const [progress, setProgress] = useState<QuestionProgressRow[]>([])
  const [error, setError] = useState('')
  const [selectedQuiz, setSelectedQuiz] = useState<string | null>(null)
  const [replayLimit, setReplayLimit] = useState(20)

  useEffect(() => {
    fetchQuizHistory().then(setRows).catch(() => setError(t('history.errorLoad')))
    fetchStreakHistory().then(setStreakRows).catch(() => {})
    fetchTimedHistory().then(setTimedRows).catch(() => {})
  }, [])

  // Contrairement aux autres blocs d'historique, `question_progress` n'a de sens que pour le quiz actuellement
  // chargé : ses lignes ne portent que l'id de question et la boîte, pas le texte — il faut `quiz.questions`
  // pour les résoudre, ce qu'on n'a que pour le quiz actif (voir `canReplay` plus bas).
  useEffect(() => {
    if (!hostedQuizId) { setProgress([]); return }
    fetchQuestionProgress(hostedQuizId).then(setProgress).catch(() => setProgress([]))
  }, [hostedQuizId])

  const activeQuizKey = hostedQuizId || quiz.metadata.title

  // Un même quiz renommé produit deux titres figés différents dans les vieilles lignes — on affiche le titre
  // le plus récent rencontré pour chaque clé (les lignes de `quiz_results` arrivent triées par date décroissante),
  // et on force le titre courant pour le quiz actuellement chargé si son historique apparaît dans la liste
  // (seul quiz dont on connaît le titre à jour sans dépendre de ce qui a été figé au moment de chaque partie).
  const keyLabels = new Map<string, string>()
  const rememberKey = (row: { quiz_id: string | null; quiz_title: string }) => {
    const key = quizKeyOf(row)
    if (!keyLabels.has(key)) keyLabels.set(key, row.quiz_title)
  }
  ;(rows ?? []).forEach(rememberKey)
  streakRows.forEach(rememberKey)
  timedRows.forEach(rememberKey)
  if (keyLabels.has(activeQuizKey)) keyLabels.set(activeQuizKey, quiz.metadata.title)
  const quizKeys = Array.from(keyLabels.keys())

  const activeQuiz = selectedQuiz && quizKeys.includes(selectedQuiz) ? selectedQuiz : (quizKeys.includes(activeQuizKey) ? activeQuizKey : quizKeys[0] ?? activeQuizKey)
  const quizRows = rows ? rows.filter((row) => quizKeyOf(row) === activeQuiz) : null
  const quizStreakRows = streakRows.filter((row) => quizKeyOf(row) === activeQuiz)
  const bestStreak = quizStreakRows.length ? Math.max(...quizStreakRows.map((row) => row.streak_count)) : 0
  const quizTimedRows = timedRows.filter((row) => quizKeyOf(row) === activeQuiz)
  const bestTimedCount = quizTimedRows.length ? Math.max(...quizTimedRows.map((row) => row.correct_count)) : 0
  const timedDurationLabel = (row: TimedResultRow) => row.duration_seconds === 0 ? t('common.unlimited') : t('common.minutesShort', Math.round(row.duration_seconds / 60))

  const records = quizRows ? computeRecords(quizRows) : null
  const chartPoints = quizRows ? [...quizRows].reverse().map((row) => ({ label: shortDate(row.created_at, language), score: row.score })) : []
  const themeBuckets = quizRows ? sumBuckets(quizRows, (row) => row.by_theme) : {}
  const typeBuckets = quizRows ? sumBuckets(quizRows, (row) => row.by_type) : {}
  const typeAxes = bucketsToRadarAxes(typeBuckets, (key) => typeLabel(t, key as Question['type']))
  // Un radar exige 3 axes : un quiz qui n'a que 1-2 types de questions garde les camemberts.
  const byType = typeAxes.length < 3 ? bucketsToChartGroups(typeBuckets, (key) => typeLabel(t, key as Question['type']), t('result.succeeded'), t('result.missed')) : []
  const byDifficulty = quizRows ? bucketsToChartGroups(sumBuckets(quizRows, (row) => row.by_difficulty), (key) => difficultyLabel(t, key as Difficulty), t('result.succeeded'), t('result.missed')) : []
  const radarAxes = bucketsToRadarAxes(themeBuckets, (key) => key)
  const radarTruncated = Object.keys(themeBuckets).length > radarAxes.length
  const heatmap = computeThemeWeekHeatmap(quizRows ?? [])

  const canReplay = activeQuiz === activeQuizKey
  // `computeDueQuestions` trie déjà de la boîte la plus basse (la plus fragile) à la plus haute : tronquer
  // ce tableau garde donc les cartes les plus prioritaires.
  const dueCards = canReplay ? computeDueQuestions(progress, quiz.questions) : []
  const replayQuestions = dueCards.map((card) => card.question)
  const replayCap = Math.min(replayLimit, replayQuestions.length)

  return <section className="stats-page">
    <div className="stats-header">
      <h2>{t('history.title')}</h2>
      <button type="button" className="secondary" onClick={onBack}>{t('common.back')}</button>
    </div>
    {error && <p className="alert" role="alert">{error}</p>}
    {!error && !rows && <p>{t('common.loading')}</p>}
    {rows && !rows.length && <p>{t('history.emptyState')}</p>}
    {quizKeys.length > 0 && <label className="quiz-select">{t('start.quizLabel')}
      <select value={activeQuiz} onChange={(event) => setSelectedQuiz(event.target.value)}>
        {quizKeys.map((key) => <option key={key} value={key}>{keyLabels.get(key)}</option>)}
      </select>
    </label>}
    {records && records.gamesPlayed > 0 && <>
      <div className="records-grid">
        <div className="record-tile"><span className="record-value">{records.gamesPlayed}</span><span className="record-label">{t('history.gamesPlayed')}</span></div>
        <div className="record-tile"><span className="record-value">{records.bestScore}%</span><span className="record-label">{t('history.bestScore')}</span></div>
        <div className="record-tile"><span className="record-value">{records.averageScore}%</span><span className="record-label">{t('history.averageScore')}</span></div>
        <div className="record-tile"><span className="record-value">{formatDuration(records.totalPlaytimeSeconds)}</span><span className="record-label">{t('history.totalPlaytime')}</span></div>
      </div>
      <ScoreChart points={chartPoints} />
      {radarAxes.length >= 3 && <RadarChart
        title={t('history.radarTitle')}
        axes={radarAxes}
        note={radarTruncated ? t('history.radarNote', radarAxes.length) : undefined}
      />}
      {heatmap.themes.length > 0 && <ThemeHeatmap
        heatmap={heatmap}
        title={t('history.heatmapTitle')}
        note={heatmap.truncated ? t('history.heatmapNote', heatmap.themes.length) : undefined}
      />}
      <RadarChart title={t('history.typeRadarTitle')} axes={typeAxes} />
      <div className="stats-groups">
        {byType.length > 0 && <div className="stats-group">
          <h3 className="stats-group-title">{t('history.byType')}</h3>
          <div className="stats-grid">{byType.map((group) => <PieChart key={`type-${group.key}`} title={group.label} data={group.data} />)}</div>
        </div>}
        <div className="stats-group">
          <h3 className="stats-group-title">{t('result.byDifficulty')}</h3>
          <div className="stats-grid">{byDifficulty.map((group) => <PieChart key={`difficulty-${group.key}`} title={group.label} data={group.data} />)}</div>
        </div>
      </div>
    </>}
    {quizStreakRows.length > 0 && <div className="stats-group">
      <h3 className="stats-group-title profile-section-title">{t('history.streakSectionTitle')}</h3>
      <div className="records-grid">
        <div className="record-tile"><span className="record-value">🔥 {bestStreak}</span><span className="record-label">{t('history.bestStreak')}</span></div>
        <div className="record-tile"><span className="record-value">{quizStreakRows.length}</span><span className="record-label">{t('history.gamesPlayed')}</span></div>
      </div>
      <ul className="history-list">
        {quizStreakRows.slice(0, 10).map((row) => <li className="history-item" key={row.id}>
          <span className="history-score">{row.victory ? '🏆' : '🔥'} {row.streak_count}</span>
          <span className="history-date">{longDate(row.created_at, language)}</span>
          <span className="history-themes">{row.themes.join(', ') || t('common.allThemes')}</span>
        </li>)}
      </ul>
    </div>}
    {quizTimedRows.length > 0 && <div className="stats-group">
      <h3 className="stats-group-title profile-section-title">{t('history.timedSectionTitle')}</h3>
      <div className="records-grid">
        <div className="record-tile"><span className="record-value">✅ {bestTimedCount}</span><span className="record-label">{t('history.bestScore')}</span></div>
        <div className="record-tile"><span className="record-value">{quizTimedRows.length}</span><span className="record-label">{t('history.gamesPlayed')}</span></div>
      </div>
      <ul className="history-list">
        {quizTimedRows.slice(0, 10).map((row) => <li className="history-item" key={row.id}>
          <span className="history-score">✅ {row.correct_count} / {row.question_count}</span>
          <span className="history-date">{longDate(row.created_at, language)}</span>
          <span className="history-themes">{row.themes.join(', ') || t('common.allThemes')}</span>
          <span>{timedDurationLabel(row)}</span>
        </li>)}
      </ul>
    </div>}
    {dueCards.length > 0 && <div className="missed-questions">
      <div className="stats-group-header">
        <h3 className="stats-group-title">{t('history.dueTitle', dueCards.length)}</h3>
        {replayQuestions.length > 0 && <label className="question-count">{t('start.questionCountLabel')}
          <select value={replayCap} onChange={(event) => setReplayLimit(Number(event.target.value))}>
            {REPLAY_COUNTS.filter((count) => count < replayQuestions.length).map((count) => <option key={count} value={count}>{t('start.questionCountOption', count, false)}</option>)}
            <option value={replayQuestions.length}>{t('start.allQuestionsOption', replayQuestions.length)}</option>
          </select>
        </label>}
        {replayQuestions.length > 0 && <button type="button" onClick={() => onReviewDue(replayQuestions.slice(0, replayCap))}>{t('history.reviewButton')}</button>}
      </div>
      <ul className="missed-list">
        {dueCards.map(({ question, box }) => <li className="missed-item" key={question.id}>
          <span>{question.question}</span>
          <span className="missed-ratio">{t('history.dueBox', box)}</span>
        </li>)}
      </ul>
    </div>}
    {quizRows && quizRows.length > 0 && <ul className="history-list">
      {quizRows.map((row) => <li className="history-item" key={row.id}>
        <span className="history-score">{row.score}%</span>
        <span className="history-date">{longDate(row.created_at, language)}</span>
        <span className="history-themes">{row.themes.join(', ')}</span>
        <span>{t('result.pointsEarned', row.earned_points, row.total_points)}</span>
        <span>{t('common.durationIcon', formatDuration(row.elapsed_seconds))}</span>
      </li>)}
    </ul>}
  </section>
}
