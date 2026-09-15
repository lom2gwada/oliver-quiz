import { useEffect, useMemo, useState } from 'react'
import type { AnswersByQuestion, Difficulty, Question, Quiz } from '../types/quiz'
import type { TranslationKey } from '../i18n'
import { useTranslation } from '../i18n'
import { formatDuration } from '../utils/time'
import { shuffle } from '../utils/shuffle'
import { questionTimeLimit } from '../utils/questionTimeLimits'
import { useQuestionTimer } from '../utils/useQuestionTimer'
import { MermaidDiagram } from './MermaidDiagram'
import { QuestionImage } from './QuestionImage'
import { QuestionRenderer } from './QuestionRenderer'

/** @deprecated Chaînes françaises figées, gardées le temps que les écrans qui l'importent encore
 * (HistoryPage.tsx, QuizContentPage.tsx) migrent vers `typeLabel(t, type)` dans une PR i18n suivante. */
export const TYPE_ICONS: Record<Question['type'], string> = { qcm: '🧩', code: '💻', text: '✍️', ordering: '🔀', boolean: '⚖️', cloze: '📝', matching: '🔗', numeric: '🎚️' }
/** @deprecated voir `TYPE_ICONS` ci-dessus. */
export const TYPE_LABELS: Record<Question['type'], string> = { qcm: 'QCM', code: 'Code', text: 'Texte', ordering: 'Ordre', boolean: 'Vrai/Faux', cloze: 'Texte à trous', matching: 'Association', numeric: 'Estimation' }

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

/** Mélange les options de réponse une fois par question, pour que la bonne réponse ne soit pas toujours au même endroit. */
function withShuffledAnswers(question: Question): Question {
  if (question.type === 'qcm') return { ...question, content: { ...question.content, answers: shuffle(question.content.answers) } }
  if (question.type === 'code') return { ...question, content: { ...question.content, answers: shuffle(question.content.answers) } }
  return question
}

interface QuizPageProps {
  quiz: Quiz
  questions: Question[]
  /** Si vrai, chaque question a un temps limite (le sien, sinon le barème par défaut) — voir `questionTimeLimits.ts`. */
  timeboxed: boolean
  onFinish: (answers: AnswersByQuestion, elapsedSeconds: number) => void
  onCancel: () => void
}

export function QuizPage({ quiz, questions, timeboxed, onFinish, onCancel }: QuizPageProps) {
  const { t } = useTranslation()
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<AnswersByQuestion>({})
  const [elapsed, setElapsed] = useState(0)
  const shuffledQuestions = useMemo(() => questions.map(withShuffledAnswers), [questions])
  const question = shuffledQuestions[current]
  const updateAnswer = (answer: AnswersByQuestion[string]) => setAnswers((previous) => ({ ...previous, [question.id]: answer }))
  const cancelQuiz = () => { if (window.confirm(t('quiz.confirmAbandonQuiz'))) onCancel() }

  useEffect(() => {
    const interval = setInterval(() => setElapsed((value) => value + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  const goNext = () => {
    if (!question) return
    if (current === shuffledQuestions.length - 1) onFinish(answers, elapsed)
    else setCurrent((value) => value + 1)
  }
  const remaining = useQuestionTimer(question?.id ?? '', timeboxed && question ? questionTimeLimit(question) : null, goNext)

  if (!question) return <section className="empty"><h2>{t('quiz.emptyTitle')}</h2><p>{t('quiz.emptyHintQuiz')}</p><button type="button" className="secondary" onClick={onCancel}>{t('common.back')}</button></section>
  const theme = quiz.themes.find((item) => item.id === question.theme)?.label ?? question.theme
  return <section className="quiz-card">
    <div className="question-meta"><span>{TYPE_ICONS[question.type]} {typeLabel(t, question.type)}</span><span>{theme}</span><span>{difficultyLabel(t, question.difficulty)}</span><span>{question.points} pts</span>{remaining !== null && <span>⏳ {remaining}s</span>}<span>⏱ {formatDuration(elapsed)}</span></div>
    <div className="quiz-progress"><div className="quiz-progress-fill" style={{ width: `${((current + 1) / shuffledQuestions.length) * 100}%` }} /></div>
    <p className="progress">{t('quiz.questionProgress', current + 1, shuffledQuestions.length)}</p>
    <div className="question-body" key={question.id}>
      {question.imageUrl && <QuestionImage src={question.imageUrl} alt={question.imageAlt} />}
      {question.diagram && <MermaidDiagram chart={question.diagram} />}
      {question.type !== 'cloze' && <h2>{question.question}</h2>}
      <QuestionRenderer question={question} answer={answers[question.id]} onChange={updateAnswer} />
    </div>
    <div className="quiz-actions">
      <button type="button" className="secondary" onClick={cancelQuiz}>{t('common.cancel')}</button>
      <div className="quiz-nav">
        <button type="button" className="secondary" onClick={() => setCurrent((value) => value - 1)} disabled={current === 0}>{t('quiz.previous')}</button>
        <button type="button" onClick={goNext}>{current === shuffledQuestions.length - 1 ? t('quiz.viewCorrection') : t('quiz.next')}</button>
      </div>
    </div>
  </section>
}
