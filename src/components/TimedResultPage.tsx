import { useEffect } from 'react'
import type { QuestionAttempt, QuizLink } from '../types/quiz'
import { useTranslation } from '../i18n'
import { formatDuration } from '@engine/utils/time'
import { playFinish, playVictory } from '@engine/utils/sound'
import { Confetti } from '@engine/components/Confetti'
import { MermaidDiagram } from './MermaidDiagram'
import { QuestionReplay } from './QuestionReplay'
import { QuestionTable } from './QuestionTable'
import { QuestionImage } from '@engine/components/QuestionImage'
import { FurtherReading } from './FurtherReading'
import { ResultActions } from './ResultActions'
import { correctAnswer, isCorrect, userAnswer } from './ResultPage'

interface TimedResultPageProps {
  attempts: QuestionAttempt[]
  elapsedSeconds: number
  durationSeconds: number
  /** Liens « Pour aller plus loin » du quiz (`metadata.links`). */
  links?: QuizLink[]
  onRestartSame: () => void
  onBackToSettings: () => void
  onViewHistory: () => void
  onViewLeaderboard: () => void
}

export function TimedResultPage({ links, attempts, elapsedSeconds, onRestartSame, onBackToSettings, onViewHistory, onViewLeaderboard }: TimedResultPageProps) {
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
    <FurtherReading links={links} />
    <div className="corrections">{attempts.map(({ question, answer }, index) => {
      const correct = isCorrect(question, answer)
      return <article className={`correction ${correct ? 'correct' : 'incorrect'}`} key={`${question.id}-${index}`}>
        <h3>{correct ? t('result.correct') : t('result.incorrect')} — {question.question}</h3>
        {question.imageUrl && <QuestionImage src={question.imageUrl} alt={question.imageAlt} />}
        {question.diagram && <MermaidDiagram chart={question.diagram} />}
        {question.table && <QuestionTable table={question.table} />}
        {!correct && <p><strong>{t('result.yourAnswer')}</strong> {userAnswer(question, answer, t)}</p>}
        {!correct && <p><strong>{t('result.correctAnswerLabel')}</strong> {correctAnswer(question, t)}</p>}
        <p>{question.explanation}</p>
        <QuestionReplay question={question} answer={answer} />
      </article>
    })}</div>
  </section>
}
