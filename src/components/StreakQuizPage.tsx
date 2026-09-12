import { useEffect, useMemo, useState } from 'react'
import type { AnswersByQuestion, Question, Quiz, UserAnswer } from '../types/quiz'
import { formatDuration } from '../utils/time'
import { shuffle } from '../utils/shuffle'
import { questionTimeLimit } from '../utils/questionTimeLimits'
import { useQuestionTimer } from '../utils/useQuestionTimer'
import { isCorrect } from './ResultPage'
import { QuestionImage } from './QuestionImage'
import { QuestionRenderer } from './QuestionRenderer'
import { TYPE_ICONS, TYPE_LABELS } from './QuizPage'

export interface StreakResult {
  streakCount: number
  elapsedSeconds: number
  victory: boolean
  playedQuestions: Question[]
  answers: AnswersByQuestion
}

interface StreakQuizPageProps {
  quiz: Quiz
  pool: Question[]
  /** Si vrai, chaque question a un temps limite (le sien, sinon le barème par défaut) — voir `questionTimeLimits.ts`. */
  timeboxed: boolean
  onFinish: (result: StreakResult) => void
  onCancel: () => void
}

export function StreakQuizPage({ quiz, pool, timeboxed, onFinish, onCancel }: StreakQuizPageProps) {
  const order = useMemo(() => shuffle(pool), [pool])
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState<UserAnswer | undefined>(undefined)
  const [answers, setAnswers] = useState<AnswersByQuestion>({})
  const [elapsed, setElapsed] = useState(0)
  const question = order[index]
  const streakCount = index

  useEffect(() => {
    const interval = setInterval(() => setElapsed((value) => value + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  const cancelQuiz = () => { if (window.confirm('Abandonner la partie en cours ? Votre série sera perdue.')) onCancel() }

  // Pas de correction affichée question par question : comme le mode classique, tout se joue "à l'aveugle"
  // et le bilan complet n'apparaît qu'à la fin (voir StreakResultPage).
  const advance = () => {
    if (!question) return
    const nextAnswers = answer === undefined ? answers : { ...answers, [question.id]: answer }
    const playedQuestions = order.slice(0, index + 1)
    if (!isCorrect(question, answer)) { onFinish({ streakCount: index, elapsedSeconds: elapsed, victory: false, playedQuestions, answers: nextAnswers }); return }
    if (index + 1 === order.length) { onFinish({ streakCount: index + 1, elapsedSeconds: elapsed, victory: true, playedQuestions, answers: nextAnswers }); return }
    setAnswers(nextAnswers)
    setIndex((value) => value + 1)
    setAnswer(undefined)
  }
  const remaining = useQuestionTimer(question?.id ?? '', timeboxed && question ? questionTimeLimit(question) : null, advance)

  if (!question) return <section className="empty"><h2>Aucune question</h2><p>Modifiez les filtres pour lancer une partie.</p><button type="button" className="secondary" onClick={onCancel}>Retour</button></section>
  const theme = quiz.themes.find((item) => item.id === question.theme)?.label ?? question.theme

  return <section className="quiz-card">
    <div className="question-meta"><span>{TYPE_ICONS[question.type]} {TYPE_LABELS[question.type]}</span><span>{theme}</span><span>{question.difficulty}</span><span>{question.points} pts</span><span>🔥 {streakCount}</span>{remaining !== null && <span>⏳ {remaining}s</span>}<span>⏱ {formatDuration(elapsed)}</span></div>
    <div className="quiz-progress"><div className="quiz-progress-fill" style={{ width: `${((index + 1) / order.length) * 100}%` }} /></div>
    <p className="progress">Question {index + 1} / {order.length}</p>
    <div className="question-body" key={question.id}>
      {question.imageUrl && <QuestionImage src={question.imageUrl} alt={question.imageAlt} />}
      {question.type !== 'cloze' && <h2>{question.question}</h2>}
      <QuestionRenderer question={question} answer={answer} onChange={setAnswer} />
    </div>
    <div className="quiz-actions">
      <button type="button" className="secondary" onClick={cancelQuiz}>Abandonner</button>
      <button type="button" onClick={advance}>{index + 1 === order.length ? 'Voir ma correction' : 'Suivante'}</button>
    </div>
  </section>
}
