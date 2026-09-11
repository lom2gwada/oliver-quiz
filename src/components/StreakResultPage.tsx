import { useEffect } from 'react'
import { formatDuration } from '../utils/time'
import { playFinish, playVictory } from '../utils/sound'
import { Confetti } from './Confetti'
import { QuestionImage } from './QuestionImage'
import { correctAnswer, userAnswer } from './ResultPage'
import type { StreakResult } from './StreakQuizPage'

interface StreakResultPageProps extends StreakResult {
  onRestart: () => void
  onViewHistory: () => void
}

export function StreakResultPage({ streakCount, elapsedSeconds, victory, lastQuestion, lastAnswer, onRestart, onViewHistory }: StreakResultPageProps) {
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
    {!victory && lastQuestion && <div className="corrections">
      <article className="correction incorrect">
        <h3>✗ Question qui a mis fin à la série — {lastQuestion.question}</h3>
        {lastQuestion.imageUrl && <QuestionImage src={lastQuestion.imageUrl} alt={lastQuestion.imageAlt} />}
        <p><strong>Votre réponse :</strong> {userAnswer(lastQuestion, lastAnswer)}</p>
        <p><strong>Bonne réponse :</strong> {correctAnswer(lastQuestion)}</p>
        <p>{lastQuestion.explanation}</p>
      </article>
    </div>}
  </section>
}
