import { useEffect } from 'react'
import type { QuestionAttempt } from '../types/quiz'
import { formatDuration } from '../utils/time'
import { playFinish, playVictory } from '../utils/sound'
import { Confetti } from './Confetti'
import { MermaidDiagram } from './MermaidDiagram'
import { QuestionImage } from './QuestionImage'
import { correctAnswer, isCorrect, userAnswer } from './ResultPage'

interface TimedResultPageProps {
  attempts: QuestionAttempt[]
  elapsedSeconds: number
  durationSeconds: number
  onRestart: () => void
  onViewHistory: () => void
}

export function TimedResultPage({ attempts, elapsedSeconds, onRestart, onViewHistory }: TimedResultPageProps) {
  const correctCount = attempts.filter((attempt) => isCorrect(attempt.question, attempt.answer)).length
  const perfect = attempts.length > 0 && correctCount === attempts.length
  useEffect(() => { perfect ? playVictory() : playFinish() }, [])
  return <section className="results">
    {perfect && <Confetti />}
    <div className="score">
      <p>Votre score</p>
      <strong>{correctCount} / {attempts.length}</strong>
      <span>bonne{correctCount > 1 ? 's' : ''} réponse{correctCount > 1 ? 's' : ''}</span>
      <p className="duration">⏱ Temps : {formatDuration(elapsedSeconds)}</p>
    </div>
    <button type="button" onClick={onRestart}>Recommencer</button>
    <div className="nav-links">
      <button type="button" className="secondary" onClick={onViewHistory}>🕓 Historique</button>
    </div>
    <div className="corrections">{attempts.map(({ question, answer }, index) => {
      const correct = isCorrect(question, answer)
      return <article className={`correction ${correct ? 'correct' : 'incorrect'}`} key={`${question.id}-${index}`}>
        <h3>{correct ? '✓ Bonne réponse' : '✗ Réponse incorrecte'} — {question.question}</h3>
        {question.imageUrl && <QuestionImage src={question.imageUrl} alt={question.imageAlt} />}
        {question.diagram && <MermaidDiagram chart={question.diagram} />}
        {!correct && <p><strong>Votre réponse :</strong> {userAnswer(question, answer)}</p>}
        {!correct && <p><strong>Bonne réponse :</strong> {correctAnswer(question)}</p>}
        <p>{question.explanation}</p>
      </article>
    })}</div>
  </section>
}
