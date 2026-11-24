import { useEffect, useState } from 'react'
import type { Question, QuestionAttempt, Quiz, UserAnswer } from '../types/quiz'
import { useTranslation } from '../i18n'
import { formatDuration } from '@engine/utils/time'
import { shuffle } from '../utils/shuffle'
import { orderUnseenFirst } from '../utils/pickUnseenQuestions'
import { questionTimeLimit, questionTimerUrgency } from '../utils/questionTimeLimits'
import { confirmDialog } from '../utils/confirmDialog'
import { abandonGameConfirm } from '../utils/confirmPresets'
import { useAdvanceGuard } from '../utils/useAdvanceGuard'
import { useQuestionTimer } from '../utils/useQuestionTimer'
import { answerSurvivesEdit, replaceQuestion } from '../utils/questionEdit'
import { useDiagramPreload } from '../utils/useDiagramPreload'
import { EditQuestionInPlay } from './EditQuestionInPlay'
import { QuestionBody } from './QuestionBody'
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
  /** Questions déjà vues, quand le joueur a choisi de découvrir d'abord les nouvelles : elles passent en premier. */
  seenIds?: ReadonlySet<string> | null
  durationSeconds: number
  /** Si vrai, chaque question a un temps limite (le sien, sinon le barème par défaut) — voir `questionTimeLimits.ts`. */
  timeboxed: boolean
  onFinish: (result: TimedResult) => void
  onCancel: () => void
  /** Présent pour qui administre le quiz joué : enregistre la question modifiée dans le quiz (rejette avec un message si c'est refusé). */
  onEditQuestion?: (updated: Question) => Promise<void>
}

export function TimedQuizPage({ quiz, pool, seenIds, durationSeconds, timeboxed, onFinish, onCancel, onEditQuestion }: TimedQuizPageProps) {
  const { t } = useTranslation()
  const [order, setOrder] = useState<Question[]>(() => orderUnseenFirst(pool, seenIds).map(withShuffledAnswers))
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState<UserAnswer | undefined>(undefined)
  const [attempts, setAttempts] = useState<QuestionAttempt[]>([])
  const [elapsed, setElapsed] = useState(0)
  // La fenêtre de modification est ouverte : chronomètres suspendus (celui de la partie comme celui de la question).
  // `editRevision` remonte la zone de réponse après une modification.
  const [editing, setEditing] = useState(false)
  const [editRevision, setEditRevision] = useState(0)
  const paused = editing && onEditQuestion !== undefined
  const question = order[index]
  useDiagramPreload(order)

  useEffect(() => {
    if (paused) return
    const interval = setInterval(() => setElapsed((value) => value + 1), 1000)
    return () => clearInterval(interval)
  }, [paused])

  // Le chrono déclenche lui-même la fin de partie quand la durée choisie est écoulée (mode "Infini" exclu, durationSeconds = 0).
  useEffect(() => {
    if (durationSeconds > 0 && elapsed >= durationSeconds) onFinish({ attempts, elapsedSeconds: durationSeconds, durationSeconds })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed])

  const cancelQuiz = async () => { if (await confirmDialog(abandonGameConfirm(t, t('start.confirmAbandon')))) onCancel() }

  // Pas de correction affichée question par question (comme le mode sans-faute) : le bilan complet
  // n'apparaît qu'à la fin. Si le pool filtré est épuisé avant la fin du temps, on remélange et ça continue.
  const advance = () => {
    if (!question) return
    setAttempts((previous) => [...previous, { question, answer }])
    if (index + 1 >= order.length) setOrder((previous) => [...previous, ...shuffle(pool).map(withShuffledAnswers)])
    setIndex((value) => value + 1)
    setAnswer(undefined)
  }
  // Un double clic sur « Suivante » compterait la question suivante comme une tentative vide.
  const canAdvance = useAdvanceGuard(question ? `${question.id}-${index}` : '')
  const goNext = () => { if (canAdvance()) advance() }
  const questionTimeLimitSeconds = timeboxed && question ? questionTimeLimit(question) : null
  const questionRemaining = useQuestionTimer(question ? `${question.id}-${index}` : '', questionTimeLimitSeconds, advance, paused)

  /** Enregistre la modification dans le quiz, puis l'applique à la partie en cours : la question affichée, et ses prochains passages, changent
   * tout de suite (voir `answerSurvivesEdit` pour la réponse déjà saisie). */
  const saveEdit = async (updated: Question) => {
    if (!onEditQuestion || !question) return
    await onEditQuestion(updated)
    if (!answerSurvivesEdit(question, updated)) setAnswer(undefined)
    setOrder((previous) => replaceQuestion(previous, updated, withShuffledAnswers))
    setEditRevision((value) => value + 1)
  }

  const finishNow = () => {
    const finalAttempts = answer === undefined ? attempts : [...attempts, { question, answer }]
    onFinish({ attempts: finalAttempts, elapsedSeconds: elapsed, durationSeconds })
  }

  if (!question) return <section className="empty"><h2>{t('quiz.emptyTitle')}</h2><p>{t('quiz.emptyHintRun')}</p><button type="button" className="secondary" onClick={onCancel}>{t('common.back')}</button></section>
  const theme = quiz.categories.find((item) => item.id === question.category)?.label ?? question.category
  const remaining = durationSeconds > 0 ? Math.max(0, durationSeconds - elapsed) : null

  return <section className="quiz-card">
    <div className="question-meta"><span>{TYPE_ICONS[question.type]} {typeLabel(t, question.type)}</span><span>{theme}</span><span>{difficultyLabel(t, question.difficulty)}</span><span>{question.points} pts</span><span>✅ {attempts.length}</span>{questionRemaining !== null && questionTimeLimitSeconds !== null && <span className={`quiz-timer-${questionTimerUrgency(questionRemaining, questionTimeLimitSeconds)}`}>⏳ {questionRemaining}s</span>}<span>⏱ {remaining !== null ? formatDuration(remaining) : formatDuration(elapsed)}</span></div>
    {durationSeconds > 0 && <div className="quiz-progress"><div className="quiz-progress-fill" style={{ width: `${Math.min(100, (elapsed / durationSeconds) * 100)}%` }} /></div>}
    <div className="question-progress-row">
      <p className="progress">{t('quiz.questionNumber', attempts.length + 1)}</p>
      {onEditQuestion && <EditQuestionInPlay question={quiz.questions.find((item) => item.id === question.id) ?? question} themes={quiz.categories} onSave={saveEdit} onOpenChange={setEditing} />}
    </div>
    <QuestionBody key={`${question.id}-${index}-${editRevision}`} question={question} answer={answer} onChange={setAnswer} onEnter={goNext} />
    <div className="quiz-actions">
      <button type="button" className="secondary" onClick={cancelQuiz}>{t('quiz.abandon')}</button>
      <div className="quiz-nav">
        <button type="button" className="secondary" onClick={finishNow}>{t('quiz.finish')}</button>
        <button type="button" onClick={goNext}>{t('quiz.next')}</button>
      </div>
    </div>
  </section>
}
