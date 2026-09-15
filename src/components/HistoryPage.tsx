import { useEffect, useState } from 'react'
import type { Difficulty, Question, Quiz } from '../types/quiz'
import type { QuestionResultRow, QuizResultRow, StreakResultRow, TimedResultRow } from '../types/history'
import type { Language } from '../i18n/types'
import { useTranslation } from '../i18n'
import { bucketsToChartGroups, bucketsToRadarAxes, computeMissedQuestions, computeRecords, fetchQuestionResults, fetchQuizHistory, fetchStreakHistory, fetchTimedHistory, sumBuckets } from '../utils/quizHistory'
import { formatDuration } from '../utils/time'
import { PieChart } from './PieChart'
import { RadarChart } from './RadarChart'
import { difficultyLabel, typeLabel } from './QuizPage'
import { ScoreChart } from './ScoreChart'

const shortDate = (iso: string, language: Language) => new Date(iso).toLocaleDateString(language === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'short' })
const longDate = (iso: string, language: Language) => new Date(iso).toLocaleDateString(language === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

export function HistoryPage({ onBack, quiz, onReplayMissed }: { onBack: () => void; quiz: Quiz; onReplayMissed: (questions: Question[]) => void }) {
  const { t, language } = useTranslation()
  const [rows, setRows] = useState<QuizResultRow[] | null>(null)
  const [questionRows, setQuestionRows] = useState<QuestionResultRow[]>([])
  const [streakRows, setStreakRows] = useState<StreakResultRow[]>([])
  const [timedRows, setTimedRows] = useState<TimedResultRow[]>([])
  const [error, setError] = useState('')
  const [selectedQuiz, setSelectedQuiz] = useState<string | null>(null)

  useEffect(() => {
    fetchQuizHistory().then(setRows).catch(() => setError(t('history.errorLoad')))
    fetchQuestionResults().then(setQuestionRows).catch(() => {})
    fetchStreakHistory().then(setStreakRows).catch(() => {})
    fetchTimedHistory().then(setTimedRows).catch(() => {})
  }, [])

  const quizTitles = rows ? Array.from(new Set(rows.map((row) => row.quiz_title))) : []
  const activeQuiz = selectedQuiz && quizTitles.includes(selectedQuiz) ? selectedQuiz : (quizTitles.includes(quiz.metadata.title) ? quiz.metadata.title : quizTitles[0] ?? quiz.metadata.title)
  const quizRows = rows ? rows.filter((row) => row.quiz_title === activeQuiz) : null
  const quizStreakRows = streakRows.filter((row) => row.quiz_title === activeQuiz)
  const bestStreak = quizStreakRows.length ? Math.max(...quizStreakRows.map((row) => row.streak_count)) : 0
  const quizTimedRows = timedRows.filter((row) => row.quiz_title === activeQuiz)
  const bestTimedCount = quizTimedRows.length ? Math.max(...quizTimedRows.map((row) => row.correct_count)) : 0
  const timedDurationLabel = (row: TimedResultRow) => row.duration_seconds === 0 ? t('common.unlimited') : t('common.minutesShort', Math.round(row.duration_seconds / 60))

  const records = quizRows ? computeRecords(quizRows) : null
  const chartPoints = quizRows ? [...quizRows].reverse().map((row) => ({ label: shortDate(row.created_at, language), score: row.score })) : []
  const themeBuckets = quizRows ? sumBuckets(quizRows, (row) => row.by_theme) : {}
  const byTheme = bucketsToChartGroups(themeBuckets, (key) => key, t('result.succeeded'), t('result.missed'))
  const byType = quizRows ? bucketsToChartGroups(sumBuckets(quizRows, (row) => row.by_type), (key) => typeLabel(t, key as Question['type']), t('result.succeeded'), t('result.missed')) : []
  const byDifficulty = quizRows ? bucketsToChartGroups(sumBuckets(quizRows, (row) => row.by_difficulty), (key) => difficultyLabel(t, key as Difficulty), t('result.succeeded'), t('result.missed')) : []
  const radarAxes = bucketsToRadarAxes(themeBuckets, (key) => key)
  const radarTruncated = Object.keys(themeBuckets).length > radarAxes.length

  const missedQuestions = activeQuiz ? computeMissedQuestions(questionRows, activeQuiz) : []
  const canReplay = activeQuiz === quiz.metadata.title
  const replayQuestions = canReplay
    ? missedQuestions.map((missed) => quiz.questions.find((question) => question.id === missed.questionId)).filter((question): question is Question => Boolean(question))
    : []

  return <section className="stats-page">
    <div className="stats-header">
      <h2>{t('history.title')}</h2>
      <button type="button" className="secondary" onClick={onBack}>{t('common.back')}</button>
    </div>
    {error && <p className="alert" role="alert">{error}</p>}
    {!error && !rows && <p>{t('common.loading')}</p>}
    {rows && !rows.length && <p>{t('history.emptyState')}</p>}
    {quizTitles.length > 0 && <label className="quiz-select">{t('start.quizLabel')}
      <select value={activeQuiz} onChange={(event) => setSelectedQuiz(event.target.value)}>
        {quizTitles.map((title) => <option key={title} value={title}>{title}</option>)}
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
      <div className="stats-groups">
        <div className="stats-group">
          <h3 className="stats-group-title">{t('result.byTheme')}</h3>
          <div className="stats-grid">{byTheme.map((group) => <PieChart key={`theme-${group.key}`} title={group.label} data={group.data} />)}</div>
        </div>
        <div className="stats-group">
          <h3 className="stats-group-title">{t('history.byType')}</h3>
          <div className="stats-grid">{byType.map((group) => <PieChart key={`type-${group.key}`} title={group.label} data={group.data} />)}</div>
        </div>
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
    {missedQuestions.length > 0 && <div className="missed-questions">
      <div className="stats-group-header">
        <h3 className="stats-group-title">{t('history.missedTitle')}</h3>
        {replayQuestions.length > 0 && <button type="button" onClick={() => onReplayMissed(replayQuestions)}>{t('history.replayMissed')}</button>}
      </div>
      <ul className="missed-list">
        {missedQuestions.map((missed) => <li className="missed-item" key={missed.questionId}>
          <span>{missed.questionText}</span>
          <span className="missed-ratio">{t('history.missedRatio', missed.wrongCount, missed.attempts)}</span>
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
