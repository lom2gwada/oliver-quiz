import { useEffect, useMemo, useState } from 'react'
import type { AnswersByQuestion, Question, Quiz } from '../types/quiz'
import { formatDuration } from '../utils/time'
import { shuffle } from '../utils/shuffle'
import { QuestionRenderer } from './QuestionRenderer'

const TYPE_ICONS: Record<Question['type'], string> = { qcm: '🧩', code: '💻', text: '✍️', ordering: '🔀', boolean: '⚖️', cloze: '📝' }
const TYPE_LABELS: Record<Question['type'], string> = { qcm: 'QCM', code: 'Code', text: 'Texte', ordering: 'Ordre', boolean: 'Vrai/Faux', cloze: 'Texte à trous' }

/** Mélange les options de réponse une fois par question, pour que la bonne réponse ne soit pas toujours au même endroit. */
function withShuffledAnswers(question: Question): Question {
  if (question.type === 'qcm') return { ...question, content: { ...question.content, answers: shuffle(question.content.answers) } }
  if (question.type === 'code') return { ...question, content: { ...question.content, answers: shuffle(question.content.answers) } }
  return question
}

interface QuizPageProps {
  quiz: Quiz
  questions: Question[]
  onFinish: (answers: AnswersByQuestion, elapsedSeconds: number) => void
}

export function QuizPage({ quiz, questions, onFinish }: QuizPageProps) {
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<AnswersByQuestion>({})
  const [elapsed, setElapsed] = useState(0)
  const shuffledQuestions = useMemo(() => questions.map(withShuffledAnswers), [questions])
  const question = shuffledQuestions[current]
  const updateAnswer = (answer: AnswersByQuestion[string]) => setAnswers((previous) => ({ ...previous, [question.id]: answer }))

  useEffect(() => {
    const interval = setInterval(() => setElapsed((value) => value + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  if (!question) return <section className="empty"><h2>Aucune question</h2><p>Modifiez les filtres pour lancer le quiz.</p></section>
  const theme = quiz.themes.find((item) => item.id === question.theme)?.label ?? question.theme
  return <section className="quiz-card">
    <div className="question-meta"><span>{TYPE_ICONS[question.type]} {TYPE_LABELS[question.type]}</span><span>{theme}</span><span>{question.difficulty}</span><span>{question.points} pts</span><span>⏱ {formatDuration(elapsed)}</span></div>
    <div className="quiz-progress"><div className="quiz-progress-fill" style={{ width: `${((current + 1) / shuffledQuestions.length) * 100}%` }} /></div>
    <p className="progress">Question {current + 1} / {shuffledQuestions.length}</p>
    <div className="question-body" key={question.id}>
      {question.type !== 'cloze' && <h2>{question.question}</h2>}
      <QuestionRenderer question={question} answer={answers[question.id]} onChange={updateAnswer} />
    </div>
    <div className="quiz-actions">
      <button type="button" className="secondary" onClick={() => setCurrent((value) => value - 1)} disabled={current === 0}>Précédente</button>
      {current === shuffledQuestions.length - 1
        ? <button type="button" onClick={() => onFinish(answers, elapsed)}>Voir ma correction</button>
        : <button type="button" onClick={() => setCurrent((value) => value + 1)}>Suivante</button>}
    </div>
  </section>
}
