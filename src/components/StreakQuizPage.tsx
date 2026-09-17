import { useEffect, useMemo, useState } from 'react'
import type { AnswersByQuestion, Question, Quiz, UserAnswer } from '../types/quiz'
import { useTranslation } from '../i18n'
import { formatDuration } from '../utils/time'
import { shuffle } from '../utils/shuffle'
import { questionTimeLimit, questionTimerUrgency } from '../utils/questionTimeLimits'
import { useQuestionTimer } from '../utils/useQuestionTimer'
import { isCorrect } from './ResultPage'
import { MermaidDiagram } from './MermaidDiagram'
import { QuestionImage } from './QuestionImage'
import { QuestionRenderer } from './QuestionRenderer'
import { TYPE_ICONS, difficultyLabel, typeLabel } from './QuizPage'

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
  const { t } = useTranslation()
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

  const cancelQuiz = () => { if (window.confirm(t('quiz.confirmAbandonStreak'))) onCancel() }

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
  const timeLimit = timeboxed && question ? questionTimeLimit(question) : null
  const remaining = useQuestionTimer(question?.id ?? '', timeLimit, advance)

  if (!question) return <section className="empty"><h2>{t('quiz.emptyTitle')}</h2><p>{t('quiz.emptyHintRun')}</p><button type="button" className="secondary" onClick={onCancel}>{t('common.back')}</button></section>
  const theme = quiz.themes.find((item) => item.id === question.theme)?.label ?? question.theme

  return <section className="quiz-card">
    <div className="question-meta"><span>{TYPE_ICONS[question.type]} {typeLabel(t, question.type)}</span><span>{theme}</span><span>{difficultyLabel(t, question.difficulty)}</span><span>{question.points} pts</span><span>🔥 {streakCount}</span>{remaining !== null && timeLimit !== null && <span className={`quiz-timer-${questionTimerUrgency(remaining, timeLimit)}`}>⏳ {remaining}s</span>}<span>⏱ {formatDuration(elapsed)}</span></div>
    <div className="quiz-progress"><div className="quiz-progress-fill" style={{ width: `${((index + 1) / order.length) * 100}%` }} /></div>
    <p className="progress">{t('quiz.questionProgress', index + 1, order.length)}</p>
    <div className="question-body" key={question.id}>
      {question.imageUrl && <QuestionImage src={question.imageUrl} alt={question.imageAlt} />}
      {question.diagram && <MermaidDiagram chart={question.diagram} />}
      {question.type !== 'cloze' && <h2>{question.question}</h2>}
      <QuestionRenderer question={question} answer={answer} onChange={setAnswer} />
    </div>
    <div className="quiz-actions">
      <button type="button" className="secondary" onClick={cancelQuiz}>{t('quiz.abandon')}</button>
      <button type="button" onClick={advance}>{index + 1 === order.length ? t('quiz.viewCorrection') : t('quiz.next')}</button>
    </div>
  </section>
}
