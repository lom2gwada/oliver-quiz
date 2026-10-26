import { useEffect, useMemo, useState } from 'react'
import type { AnswersByQuestion, Difficulty, Question, Quiz } from '../types/quiz'
import type { TranslationKey } from '../i18n'
import { useTranslation } from '../i18n'
import { formatDuration } from '@engine/utils/time'
import { shuffle, shuffleAwayFrom } from '../utils/shuffle'
import { questionTimeLimit, questionTimerUrgency } from '../utils/questionTimeLimits'
import { useQuestionTimer } from '../utils/useQuestionTimer'
import { dictationLanguageTag } from '../utils/dictation'
import { confirmDialog } from '../utils/confirmDialog'
import { abandonGameConfirm } from '../utils/confirmPresets'
import { useAdvanceGuard } from '../utils/useAdvanceGuard'
import { hasAnswer } from '../utils/hasAnswer'
import { MAX_BOX } from '../utils/leitner'
import { questionToSpeech } from '../utils/speech'
import { ListenButton } from './ListenButton'
import { QuestionBody } from './QuestionBody'

export const TYPE_ICONS: Record<Question['type'], string> = { qcm: '🧩', code: '💻', text: '✍️', ordering: '🔀', boolean: '⚖️', cloze: '📝', matching: '🔗', numeric: '🎚️' }

const TYPE_LABEL_KEYS: Record<Question['type'], TranslationKey> = {
  qcm: 'quiz.typeQcm', code: 'quiz.typeCode', text: 'quiz.typeText', ordering: 'quiz.typeOrdering',
  boolean: 'quiz.typeBoolean', cloze: 'quiz.typeCloze', matching: 'quiz.typeMatching', numeric: 'quiz.typeNumeric',
}
const DIFFICULTY_LABEL_KEYS: Record<Difficulty, TranslationKey> = {
  easy: 'quiz.difficultyEasy', medium: 'quiz.difficultyMedium', hard: 'quiz.difficultyHard',
}
export function typeLabel(t: (key: TranslationKey, ...args: unknown[]) => string, type: Question['type']): string {
  return t(TYPE_LABEL_KEYS[type])
}
export function difficultyLabel(t: (key: TranslationKey, ...args: unknown[]) => string, difficulty: Difficulty): string {
  return t(DIFFICULTY_LABEL_KEYS[difficulty])
}

/** Mélange les options de réponse une fois par question, pour que la bonne réponse ne soit pas toujours au même endroit.
 * Les colonnes d'une association sont mélangées ici plutôt que dans le composant : la question mélangée est
 * conservée pour la correction, qui peut ainsi remontrer la question dans l'ordre où elle a été jouée.
 * Les items d'une question "Ordre" sont mélangés eux aussi, et jamais dans l'ordre de la solution : l'ordre de
 * stockage est celui de l'auteur, souvent déjà le bon. */
export function withShuffledAnswers(question: Question): Question {
  if (question.type === 'qcm') return { ...question, content: { ...question.content, answers: shuffle(question.content.answers) } }
  if (question.type === 'code') return { ...question, content: { ...question.content, answers: shuffle(question.content.answers) } }
  if (question.type === 'ordering') return { ...question, content: { ...question.content, items: shuffleAwayFrom(question.content.items, question.content.correctOrder) } }
  if (question.type === 'matching') return { ...question, content: { ...question.content, left: shuffle(question.content.left), right: shuffle(question.content.right) } }
  return question
}

interface QuizPageProps {
  quiz: Quiz
  questions: Question[]
  /** Si vrai, chaque question a un temps limite (le sien, sinon le barème par défaut) — voir `questionTimeLimits.ts`. */
  timeboxed: boolean
  /** `playedQuestions` : les questions telles qu'elles ont été affichées (réponses mélangées), pour la correction. */
  onFinish: (answers: AnswersByQuestion, elapsedSeconds: number, playedQuestions: Question[]) => void
  onCancel: () => void
  /** Présent pour une révision : la boîte Leitner de chaque question avant la session. Signale le mode (bandeau, boîte)
   * et empêche de passer une question sans réponse par erreur (voir « Passer »). */
  reviewBoxes?: Record<string, number>
}

export function QuizPage({ quiz, questions, timeboxed, onFinish, onCancel, reviewBoxes }: QuizPageProps) {
  const { t, language } = useTranslation()
  // Lecture de l'énoncé dans la langue du quiz (celle de l'interface à défaut) — même règle que la dictée.
  const speechTag = dictationLanguageTag(quiz.metadata.language, language)
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<AnswersByQuestion>({})
  const [elapsed, setElapsed] = useState(0)
  const shuffledQuestions = useMemo(() => questions.map(withShuffledAnswers), [questions])
  const question = shuffledQuestions[current]
  const updateAnswer = (answer: AnswersByQuestion[string]) => setAnswers((previous) => ({ ...previous, [question.id]: answer }))
  const cancelQuiz = async () => { if (await confirmDialog(abandonGameConfirm(t, t('quiz.confirmAbandonQuiz')))) onCancel() }

  useEffect(() => {
    const interval = setInterval(() => setElapsed((value) => value + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  const canAdvance = useAdvanceGuard(question?.id ?? '')
  const advance = () => {
    if (!question) return
    if (current === shuffledQuestions.length - 1) onFinish(answers, elapsed, shuffledQuestions)
    else setCurrent((value) => value + 1)
  }
  // « Suivante » et Entrée ignorent un clic qui suit de trop près l'affichage de la question (double clic) ; l'expiration
  // du temps limite, elle, avance toujours.
  const goNext = () => { if (canAdvance()) advance() }
  // En révision, « Suivante » et Entrée ne passent pas une question laissée vide : seul « Passer », distinct, le fait.
  const reviewing = reviewBoxes !== undefined
  const unanswered = reviewing && question !== undefined && !hasAnswer(answers[question.id])
  const timeLimit = timeboxed && question ? questionTimeLimit(question) : null
  const remaining = useQuestionTimer(question?.id ?? '', timeLimit, advance)

  if (!question) return <section className="empty"><h2>{t('quiz.emptyTitle')}</h2><p>{t('quiz.emptyHintQuiz')}</p><button type="button" className="secondary" onClick={onCancel}>{t('common.back')}</button></section>
  const theme = quiz.categories.find((item) => item.id === question.category)?.label ?? question.category
  return <section className="quiz-card">
    {reviewing && <div className="review-banner">
      <strong>{t('review.banner')}</strong>
      <span title={t('review.boxHint')}>{t('review.box', reviewBoxes[question.id] ?? 1, MAX_BOX)}</span>
    </div>}
    <div className="question-meta"><span>{TYPE_ICONS[question.type]} {typeLabel(t, question.type)}</span><span>{theme}</span><span>{difficultyLabel(t, question.difficulty)}</span><span>{question.points} pts</span>{remaining !== null && timeLimit !== null && <span className={`quiz-timer-${questionTimerUrgency(remaining, timeLimit)}`}>⏳ {remaining}s</span>}{!timeboxed && <span>⏱ {formatDuration(elapsed)}</span>}</div>
    <div className="quiz-progress"><div className="quiz-progress-fill" style={{ width: `${((current + 1) / shuffledQuestions.length) * 100}%` }} /></div>
    <div className="question-progress-row">
      <p className="progress">{t('quiz.questionProgress', current + 1, shuffledQuestions.length)}</p>
      {/* Pas de lecture avec le chrono par question : elle mangerait le temps de réponse. Cette page ne sert qu'au mode
          classique et à la révision ; les modes sans-faute et contre-la-montre n'ont pas ce bouton. */}
      {!timeboxed && <ListenButton key={question.id} text={questionToSpeech(question, speechTag)} languageTag={speechTag} />}
    </div>
    <QuestionBody key={question.id} question={question} answer={answers[question.id]} onChange={updateAnswer} onEnter={() => { if (!unanswered) goNext() }} />
    <div className="quiz-actions">
      <button type="button" className="secondary" onClick={cancelQuiz}>{t('common.cancel')}</button>
      <div className="quiz-nav">
        {/* Revenir en arrière permettrait de relire une question déjà expirée sans pression de temps : pas de sens en mode chrono. */}
        {!timeboxed && <button type="button" className="secondary" onClick={() => setCurrent((value) => value - 1)} disabled={current === 0}>{t('quiz.previous')}</button>}
        {unanswered
          ? <button type="button" className="secondary" title={t('quiz.skipHint')} onClick={goNext}>{t('quiz.skip')}</button>
          : <button type="button" onClick={goNext}>{current === shuffledQuestions.length - 1 ? t('quiz.viewCorrection') : t('quiz.next')}</button>}
      </div>
    </div>
  </section>
}
