import { useState } from 'react'
import type { AnswersByQuestion, Question, Quiz } from '../types/quiz'
import { QuestionRenderer } from './QuestionRenderer'

interface QuizPageProps {
  quiz: Quiz
  questions: Question[]
  onFinish: (answers: AnswersByQuestion) => void
}

export function QuizPage({ quiz, questions, onFinish }: QuizPageProps) {
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<AnswersByQuestion>({})
  const question = questions[current]
  const updateAnswer = (answer: AnswersByQuestion[string]) => setAnswers((previous) => ({ ...previous, [question.id]: answer }))

  if (!question) return <section className="empty"><h2>Aucune question</h2><p>Modifiez les filtres pour lancer le quiz.</p></section>
  const theme = quiz.themes.find((item) => item.id === question.theme)?.label ?? question.theme
  return <section className="quiz-card">
    <div className="question-meta"><span>{theme}</span><span>{question.difficulty}</span><span>{question.points} pts</span></div>
    <p className="progress">Question {current + 1} / {questions.length}</p>
    <h2>{question.question}</h2>
    <QuestionRenderer question={question} answer={answers[question.id]} onChange={updateAnswer} />
    <div className="quiz-actions">
      <button type="button" className="secondary" onClick={() => setCurrent((value) => value - 1)} disabled={current === 0}>Précédente</button>
      {current === questions.length - 1
        ? <button type="button" onClick={() => onFinish(answers)}>Voir ma correction</button>
        : <button type="button" onClick={() => setCurrent((value) => value + 1)}>Suivante</button>}
    </div>
  </section>
}
