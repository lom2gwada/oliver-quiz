import { useEffect } from 'react'
import { CorrectionList } from './CorrectionList'
import type { QuestionAttempt, QuizLink } from '../types/quiz'
import { useTranslation } from '../i18n'
import { formatDuration } from '@engine/utils/time'
import { playFinish, playVictory } from '@engine/utils/sound'
import { Confetti } from '@engine/components/Confetti'
import { FurtherReading } from './FurtherReading'
import { ResultActions } from './ResultActions'
import { ResultNavLinks } from './ResultNavLinks'
import { isCorrect } from '../utils/answerCheck'

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
  onViewOverview: () => void
}

export function TimedResultPage({ links, attempts, elapsedSeconds, onRestartSame, onBackToSettings, onViewHistory, onViewLeaderboard, onViewOverview }: TimedResultPageProps) {
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
    <ResultNavLinks onViewHistory={onViewHistory} onViewLeaderboard={onViewLeaderboard} onViewOverview={onViewOverview} />
    <FurtherReading links={links} />
    <CorrectionList items={attempts.map(({ question, answer }, index) => ({ key: `${question.id}-${index}`, question, answer }))} onRestartSame={onRestartSame} onBackToSettings={onBackToSettings} />
  </section>
}
