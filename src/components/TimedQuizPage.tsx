import { useEffect, useState } from 'react'
import type { Question, QuestionAttempt, Quiz, UserAnswer } from '../types/quiz'
import { useTranslation } from '../i18n'
import { formatDuration } from '../utils/time'
import { shuffle } from '../utils/shuffle'
import { questionTimeLimit, questionTimerUrgency } from '../utils/questionTimeLimits'
import { useQuestionTimer } from '../utils/useQuestionTimer'
import { MermaidDiagram } from './MermaidDiagram'
import { QuestionImage } from './QuestionImage'
import { QuestionRenderer } from './QuestionRenderer'
import { TYPE_ICONS, difficultyLabel, typeLabel, withShuffledAnswers } from './QuizPage'

export interface TimedResult {
  attempts: QuestionAttempt[]
  elapsedSeconds: number
  /** 0 = mode "Infini". */
  durationSeconds: number
}

interface TimedQuizPageProps {
  quiz: Quiz
  pool: Question[]
  durationSeconds: number
  /** Si vrai, chaque question a un temps limite (le sien, sinon le barème par défaut) — voir `questionTimeLimits.ts`. */
  timeboxed: boolean
  onFinish: (result: TimedResult) => void
  onCancel: () => void
}

export function TimedQuizPage({ quiz, pool, durationSeconds, timeboxed, onFinish, onCancel }: TimedQuizPageProps) {
  const { t } = useTranslation()
  const [order, setOrder] = useState<Question[]>(() => shuffle(pool).map(withShuffledAnswers))
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState<UserAnswer | undefined>(undefined)
  const [attempts, setAttempts] = useState<QuestionAttempt[]>([])
  const [elapsed, setElapsed] = useState(0)
  const question = order[index]

  useEffect(() => {
    const interval = setInterval(() => setElapsed((value) => value + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  // Le chrono déclenche lui-même la fin de partie quand la durée choisie est écoulée (mode "Infini" exclu, durationSeconds = 0).
  useEffect(() => {
    if (durationSeconds > 0 && elapsed >= durationSeconds) onFinish({ attempts, elapsedSeconds: durationSeconds, durationSeconds })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed])

  const cancelQuiz = () => { if (window.confirm(t('start.confirmAbandon'))) onCancel() }

  // Pas de correction affichée question par question (comme le mode sans-faute) : le bilan complet
  // n'apparaît qu'à la fin. Si le pool filtré est épuisé avant la fin du temps, on remélange et ça continue.
  const advance = () => {
    if (!question) return
    setAttempts((previous) => [...previous, { question, answer }])
    if (index + 1 >= order.length) setOrder((previous) => [...previous, ...shuffle(pool).map(withShuffledAnswers)])
    setIndex((value) => value + 1)
    setAnswer(undefined)
  }
  const questionTimeLimitSeconds = timeboxed && question ? questionTimeLimit(question) : null
  const questionRemaining = useQuestionTimer(question ? `${question.id}-${index}` : '', questionTimeLimitSeconds, advance)

  const finishNow = () => {
    const finalAttempts = answer === undefined ? attempts : [...attempts, { question, answer }]
    onFinish({ attempts: finalAttempts, elapsedSeconds: elapsed, durationSeconds })
  }

  if (!question) return <section className="empty"><h2>{t('quiz.emptyTitle')}</h2><p>{t('quiz.emptyHintRun')}</p><button type="button" className="secondary" onClick={onCancel}>{t('common.back')}</button></section>
  const theme = quiz.themes.find((item) => item.id === question.theme)?.label ?? question.theme
  const remaining = durationSeconds > 0 ? Math.max(0, durationSeconds - elapsed) : null

  return <section className="quiz-card">
    <div className="question-meta"><span>{TYPE_ICONS[question.type]} {typeLabel(t, question.type)}</span><span>{theme}</span><span>{difficultyLabel(t, question.difficulty)}</span><span>{question.points} pts</span><span>✅ {attempts.length}</span>{questionRemaining !== null && questionTimeLimitSeconds !== null && <span className={`quiz-timer-${questionTimerUrgency(questionRemaining, questionTimeLimitSeconds)}`}>⏳ {questionRemaining}s</span>}<span>⏱ {remaining !== null ? formatDuration(remaining) : formatDuration(elapsed)}</span></div>
    {durationSeconds > 0 && <div className="quiz-progress"><div className="quiz-progress-fill" style={{ width: `${Math.min(100, (elapsed / durationSeconds) * 100)}%` }} /></div>}
    <p className="progress">{t('quiz.questionNumber', attempts.length + 1)}</p>
    <div className="question-body" key={`${question.id}-${index}`}>
      {question.imageUrl && <QuestionImage src={question.imageUrl} alt={question.imageAlt} />}
      {question.diagram && <MermaidDiagram chart={question.diagram} />}
      {question.type !== 'cloze' && <h2>{question.question}</h2>}
      <QuestionRenderer question={question} answer={answer} onChange={setAnswer} />
    </div>
    <div className="quiz-actions">
      <button type="button" className="secondary" onClick={cancelQuiz}>{t('quiz.abandon')}</button>
      <div className="quiz-nav">
        <button type="button" className="secondary" onClick={finishNow}>{t('quiz.finish')}</button>
        <button type="button" onClick={advance}>{t('quiz.next')}</button>
      </div>
    </div>
  </section>
}
