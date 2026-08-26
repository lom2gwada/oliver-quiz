import { useEffect, useState } from 'react'
import type { Profile } from '../types/profile'
import type { Question, Quiz } from '../types/quiz'
import type { QuestionResultRow, QuizResultRow } from '../types/history'
import { bucketsToChartGroups, computeMissedQuestions, computeRecords, fetchQuestionResults, fetchQuizHistory, sumBuckets } from '../utils/quizHistory'
import { playClick } from '../utils/sound'
import { formatDuration } from '../utils/time'
import { DIFFICULTY_LABELS } from './ResultPage'
import { PieChart } from './PieChart'
import { TYPE_LABELS } from './QuizPage'
import { ScoreChart } from './ScoreChart'

export const AVATAR_OPTIONS = ['🙂', '😎', '🤓', '🦊', '🐱', '🐶', '🦁', '🐼', '🚀', '🎯', '⭐', '🔥']

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
const longDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

interface ProfilePageProps {
  profile: Profile | null
  quiz: Quiz
  onBack: () => void
  onSave: (profile: Profile) => Promise<void>
  onReplayMissed: (questions: Question[]) => void
}

export function ProfilePage({ profile, quiz, onBack, onSave, onReplayMissed }: ProfilePageProps) {
  const [pseudo, setPseudo] = useState(profile?.pseudo ?? '')
  const [avatar, setAvatar] = useState(profile?.avatar ?? AVATAR_OPTIONS[0])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [rows, setRows] = useState<QuizResultRow[] | null>(null)
  const [questionRows, setQuestionRows] = useState<QuestionResultRow[]>([])
  const [historyError, setHistoryError] = useState('')
  const [selectedQuiz, setSelectedQuiz] = useState<string | null>(null)

  useEffect(() => {
    fetchQuizHistory().then(setRows).catch(() => setHistoryError("Impossible de charger l'historique."))
    fetchQuestionResults().then(setQuestionRows).catch(() => {})
  }, [])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true); setError(''); setSaved(false)
    try {
      await onSave({ pseudo: pseudo.trim(), avatar })
      setSaved(true)
    } catch {
      setError("Impossible d'enregistrer le profil. Réessayez.")
    } finally {
      setSaving(false)
    }
  }

  const quizTitles = rows ? Array.from(new Set(rows.map((row) => row.quiz_title))) : []
  const activeQuiz = selectedQuiz && quizTitles.includes(selectedQuiz) ? selectedQuiz : (quizTitles.includes(quiz.metadata.title) ? quiz.metadata.title : quizTitles[0])
  const quizRows = rows ? rows.filter((row) => row.quiz_title === activeQuiz) : null

  const records = quizRows ? computeRecords(quizRows) : null
  const chartPoints = quizRows ? [...quizRows].reverse().map((row) => ({ label: shortDate(row.created_at), score: row.score })) : []
  const byTheme = quizRows ? bucketsToChartGroups(sumBuckets(quizRows, (row) => row.by_theme), (key) => key) : []
  const byType = quizRows ? bucketsToChartGroups(sumBuckets(quizRows, (row) => row.by_type), (key) => TYPE_LABELS[key as keyof typeof TYPE_LABELS] ?? key) : []
  const byDifficulty = quizRows ? bucketsToChartGroups(sumBuckets(quizRows, (row) => row.by_difficulty), (key) => DIFFICULTY_LABELS[key as keyof typeof DIFFICULTY_LABELS] ?? key) : []

  const missedQuestions = activeQuiz ? computeMissedQuestions(questionRows, activeQuiz) : []
  const canReplay = activeQuiz === quiz.metadata.title
  const replayQuestions = canReplay
    ? missedQuestions.map((missed) => quiz.questions.find((question) => question.id === missed.questionId)).filter((question): question is Question => Boolean(question))
    : []

  return <section className="stats-page">
    <div className="stats-header">
      <h2>Profil</h2>
      <button type="button" className="secondary" onClick={onBack}>Retour</button>
    </div>
    <form className="profile-form" onSubmit={submit}>
      <label>Pseudo
        <input value={pseudo} onChange={(event) => { setPseudo(event.target.value); setSaved(false) }} required maxLength={30} placeholder="Ton prénom ou pseudo" />
      </label>
      <fieldset className="avatar-picker">
        <legend>Avatar</legend>
        <div className="avatar-options">
          {AVATAR_OPTIONS.map((option) => <label key={option} className="avatar-option">
            <input type="radio" name="avatar" value={option} checked={avatar === option} onChange={() => { playClick(); setAvatar(option); setSaved(false) }} />
            <span>{option}</span>
          </label>)}
        </div>
      </fieldset>
      {error && <p className="alert" role="alert">{error}</p>}
      {saved && !error && <p className="profile-saved">Profil enregistré ✓</p>}
      <button type="submit" disabled={saving || !pseudo.trim()}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
    </form>

    <h3 className="stats-group-title profile-history-title">Historique des parties</h3>
    {historyError && <p className="alert" role="alert">{historyError}</p>}
    {!historyError && !rows && <p>Chargement…</p>}
    {rows && !rows.length && <p>Aucune partie enregistrée pour l'instant.</p>}
    {quizTitles.length > 1 && <label className="quiz-select">Quiz
      <select value={activeQuiz} onChange={(event) => setSelectedQuiz(event.target.value)}>
        {quizTitles.map((title) => <option key={title} value={title}>{title}</option>)}
      </select>
    </label>}
    {records && records.gamesPlayed > 0 && <>
      <div className="records-grid">
        <div className="record-tile"><span className="record-value">{records.gamesPlayed}</span><span className="record-label">Parties jouées</span></div>
        <div className="record-tile"><span className="record-value">{records.bestScore}%</span><span className="record-label">Meilleur score</span></div>
        <div className="record-tile"><span className="record-value">{records.averageScore}%</span><span className="record-label">Score moyen</span></div>
        <div className="record-tile"><span className="record-value">{formatDuration(records.totalPlaytimeSeconds)}</span><span className="record-label">Temps de jeu cumulé</span></div>
      </div>
      <ScoreChart points={chartPoints} />
      <div className="stats-groups">
        <div className="stats-group">
          <h3 className="stats-group-title">Par thème</h3>
          <div className="stats-grid">{byTheme.map((group) => <PieChart key={`theme-${group.key}`} title={group.label} data={group.data} />)}</div>
        </div>
        <div className="stats-group">
          <h3 className="stats-group-title">Par type de question</h3>
          <div className="stats-grid">{byType.map((group) => <PieChart key={`type-${group.key}`} title={group.label} data={group.data} />)}</div>
        </div>
        <div className="stats-group">
          <h3 className="stats-group-title">Par difficulté</h3>
          <div className="stats-grid">{byDifficulty.map((group) => <PieChart key={`difficulty-${group.key}`} title={group.label} data={group.data} />)}</div>
        </div>
      </div>
    </>}
    {missedQuestions.length > 0 && <div className="missed-questions">
      <div className="stats-group-header">
        <h3 className="stats-group-title">Questions à retravailler</h3>
        {replayQuestions.length > 0 && <button type="button" onClick={() => onReplayMissed(replayQuestions)}>Reprendre mes erreurs</button>}
      </div>
      <ul className="missed-list">
        {missedQuestions.map((missed) => <li className="missed-item" key={missed.questionId}>
          <span>{missed.questionText}</span>
          <span className="missed-ratio">Ratée {missed.wrongCount} fois sur {missed.attempts}</span>
        </li>)}
      </ul>
    </div>}
    {quizRows && quizRows.length > 0 && <ul className="history-list">
      {quizRows.map((row) => <li className="history-item" key={row.id}>
        <span className="history-score">{row.score}%</span>
        <span className="history-date">{longDate(row.created_at)}</span>
        <span className="history-themes">{row.themes.join(', ')}</span>
        <span>{row.earned_points} / {row.total_points} pts</span>
        <span>⏱ {formatDuration(row.elapsed_seconds)}</span>
      </li>)}
    </ul>}
  </section>
}
