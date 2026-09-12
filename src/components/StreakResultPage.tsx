import { useEffect } from 'react'
import type { AnswersByQuestion, Question } from '../types/quiz'
import { formatDuration } from '../utils/time'
import { playFinish, playVictory } from '../utils/sound'
import { Confetti } from './Confetti'
import { MermaidDiagram } from './MermaidDiagram'
import { QuestionImage } from './QuestionImage'
import { correctAnswer, isCorrect, userAnswer } from './ResultPage'

interface StreakResultPageProps {
  streakCount: number
  elapsedSeconds: number
  victory: boolean
  playedQuestions: Question[]
  answers: AnswersByQuestion
  onRestart: () => void
  onViewHistory: () => void
}

export function StreakResultPage({ streakCount, elapsedSeconds, victory, playedQuestions, answers, onRestart, onViewHistory }: StreakResultPageProps) {
  useEffect(() => { victory ? playVictory() : playFinish() }, [])
  return <section className="results">
    {victory && <Confetti />}
    <div className="score">
      <p>{victory ? 'Sans-faute total !' : 'Votre série'}</p>
      <strong>{streakCount}</strong>
      <span>bonne{streakCount > 1 ? 's' : ''} réponse{streakCount > 1 ? 's' : ''} d'affilée</span>
      <p className="mention">{victory ? '🏆 Vous avez tout réussi' : '🔥 Belle série, la prochaine sera la bonne'}</p>
      <p className="duration">⏱ Temps : {formatDuration(elapsedSeconds)}</p>
    </div>
    <button type="button" onClick={onRestart}>Recommencer</button>
    <div className="nav-links">
      <button type="button" className="secondary" onClick={onViewHistory}>🕓 Historique</button>
    </div>
    <div className="corrections">{playedQuestions.map((question) => {
      const correct = isCorrect(question, answers[question.id])
      return <article className={`correction ${correct ? 'correct' : 'incorrect'}`} key={question.id}>
        <h3>{correct ? '✓ Bonne réponse' : '✗ Réponse incorrecte'} — {question.question}</h3>
        {question.imageUrl && <QuestionImage src={question.imageUrl} alt={question.imageAlt} />}
        {question.diagram && <MermaidDiagram chart={question.diagram} />}
        {!correct && <p><strong>Votre réponse :</strong> {userAnswer(question, answers[question.id])}</p>}
        {!correct && <p><strong>Bonne réponse :</strong> {correctAnswer(question)}</p>}
        <p>{question.explanation}</p>
      </article>
    })}</div>
  </section>
}
