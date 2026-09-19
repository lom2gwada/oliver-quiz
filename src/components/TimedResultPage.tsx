import { useEffect } from 'react'
import type { QuestionAttempt } from '../types/quiz'
import { useTranslation } from '../i18n'
import { formatDuration } from '../utils/time'
import { playFinish, playVictory } from '../utils/sound'
import { Confetti } from './Confetti'
import { MermaidDiagram } from './MermaidDiagram'
import { QuestionImage } from './QuestionImage'
import { ResultActions } from './ResultActions'
import { correctAnswer, isCorrect, userAnswer } from './ResultPage'

interface TimedResultPageProps {
  attempts: QuestionAttempt[]
  elapsedSeconds: number
  durationSeconds: number
  onRestartSame: () => void
  onBackToSettings: () => void
  onViewHistory: () => void
  onViewLeaderboard: () => void
}

export function TimedResultPage({ attempts, elapsedSeconds, onRestartSame, onBackToSettings, onViewHistory, onViewLeaderboard }: TimedResultPageProps) {
  const { t } = useTranslation()
  const correctCount = attempts.filter((attempt) => isCorrect(attempt.question, attempt.answer)).length
  const perfect = attempts.length > 0 && correctCount === attempts.length
  useEffect(() => { perfect ? playVictory() : playFinish() }, [])
  return <section className="results">
    {perfect && <Confetti />}
    <div className="score">
      <p>{t('result.yourScore')}</p>
      <strong>{correctCount} / {attempts.length}</strong>
      <span>{t('timed.correctAnswers', correctCount)}</span>
      <p className="duration">{t('result.duration', formatDuration(elapsedSeconds))}</p>
    </div>
    <ResultActions onRestartSame={onRestartSame} onBackToSettings={onBackToSettings} />
    <div className="nav-links">
      <button type="button" className="secondary" onClick={onViewHistory}>{t('common.viewHistory')}</button>
      <button type="button" className="secondary" onClick={onViewLeaderboard}>{t('common.viewLeaderboard')}</button>
    </div>
    <div className="corrections">{attempts.map(({ question, answer }, index) => {
      const correct = isCorrect(question, answer)
      return <article className={`correction ${correct ? 'correct' : 'incorrect'}`} key={`${question.id}-${index}`}>
        <h3>{correct ? t('result.correct') : t('result.incorrect')} — {question.question}</h3>
        {question.imageUrl && <QuestionImage src={question.imageUrl} alt={question.imageAlt} />}
        {question.diagram && <MermaidDiagram chart={question.diagram} />}
        {!correct && <p><strong>{t('result.yourAnswer')}</strong> {userAnswer(question, answer, t)}</p>}
        {!correct && <p><strong>{t('result.correctAnswerLabel')}</strong> {correctAnswer(question, t)}</p>}
        <p>{question.explanation}</p>
      </article>
    })}</div>
  </section>
}
