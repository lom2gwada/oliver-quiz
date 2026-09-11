import { useEffect, useMemo, useState } from 'react'
import type { Question, Quiz, UserAnswer } from '../types/quiz'
import { formatDuration } from '../utils/time'
import { shuffle } from '../utils/shuffle'
import { isCorrect, correctAnswer, userAnswer } from './ResultPage'
import { QuestionImage } from './QuestionImage'
import { QuestionRenderer } from './QuestionRenderer'
import { TYPE_ICONS, TYPE_LABELS } from './QuizPage'

export interface StreakResult {
  streakCount: number
  elapsedSeconds: number
  victory: boolean
  themeIds: string[]
  lastQuestion?: Question
  lastAnswer?: UserAnswer
}

interface StreakQuizPageProps {
  quiz: Quiz
  pool: Question[]
  onFinish: (result: StreakResult) => void
  onCancel: () => void
}

export function StreakQuizPage({ quiz, pool, onFinish, onCancel }: StreakQuizPageProps) {
  const order = useMemo(() => shuffle(pool), [pool])
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState<UserAnswer | undefined>(undefined)
  const [revealed, setRevealed] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [themeIds, setThemeIds] = useState<string[]>([])
  const question = order[index]
  const streakCount = index

  useEffect(() => {
    const interval = setInterval(() => setElapsed((value) => value + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  const cancelQuiz = () => { if (window.confirm('Abandonner la partie en cours ? Votre série sera perdue.')) onCancel() }

  const validate = () => {
    setThemeIds((previous) => [...previous, question.theme])
    setRevealed(true)
  }

  const advance = () => {
    const correct = isCorrect(question, answer)
    if (!correct) { onFinish({ streakCount, elapsedSeconds: elapsed, victory: false, themeIds, lastQuestion: question, lastAnswer: answer }); return }
    if (index + 1 === order.length) { onFinish({ streakCount: streakCount + 1, elapsedSeconds: elapsed, victory: true, themeIds }); return }
    setIndex((value) => value + 1)
    setAnswer(undefined)
    setRevealed(false)
  }

  if (!question) return <section className="empty"><h2>Aucune question</h2><p>Modifiez les filtres pour lancer une partie.</p><button type="button" className="secondary" onClick={onCancel}>Retour</button></section>
  const theme = quiz.themes.find((item) => item.id === question.theme)?.label ?? question.theme
  const correct = revealed ? isCorrect(question, answer) : false

  return <section className="quiz-card">
    <div className="question-meta"><span>{TYPE_ICONS[question.type]} {TYPE_LABELS[question.type]}</span><span>{theme}</span><span>{question.difficulty}</span><span>{question.points} pts</span><span>🔥 {streakCount}</span><span>⏱ {formatDuration(elapsed)}</span></div>
    <div className="quiz-progress"><div className="quiz-progress-fill" style={{ width: `${((index + 1) / order.length) * 100}%` }} /></div>
    <p className="progress">Question {index + 1} / {order.length}</p>
    <div className="question-body" key={question.id}>
      {question.imageUrl && <QuestionImage src={question.imageUrl} alt={question.imageAlt} />}
      {question.type !== 'cloze' && <h2>{question.question}</h2>}
      <QuestionRenderer question={question} answer={answer} onChange={setAnswer} />
      {revealed && <article className={`correction ${correct ? 'correct' : 'incorrect'}`}>
        <h3>{correct ? '✓ Bonne réponse' : '✗ Réponse incorrecte'}</h3>
        {!correct && <p><strong>Votre réponse :</strong> {userAnswer(question, answer)}</p>}
        {!correct && <p><strong>Bonne réponse :</strong> {correctAnswer(question)}</p>}
        <p>{question.explanation}</p>
      </article>}
    </div>
    <div className="quiz-actions">
      <button type="button" className="secondary" onClick={cancelQuiz}>Abandonner</button>
      {!revealed
        ? <button type="button" onClick={validate}>Valider</button>
        : <button type="button" onClick={advance}>{correct ? (index + 1 === order.length ? 'Terminer en beauté 🏆' : 'Question suivante') : 'Voir le résultat'}</button>}
    </div>
  </section>
}
