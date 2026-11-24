import { useEffect } from 'react'
import { CorrectionList } from './CorrectionList'
import type { AnswersByQuestion, Question, QuizLink } from '../types/quiz'
import { useTranslation } from '../i18n'
import { formatDuration } from '@engine/utils/time'
import { playFinish, playVictory } from '@engine/utils/sound'
import { Confetti } from '@engine/components/Confetti'
import { FurtherReading } from './FurtherReading'
import { ResultActions } from './ResultActions'
import { ResultNavLinks } from './ResultNavLinks'

interface StreakResultPageProps {
  streakCount: number
  elapsedSeconds: number
  victory: boolean
  /** Liens « Pour aller plus loin » du quiz (`metadata.links`). */
  links?: QuizLink[]
  playedQuestions: Question[]
  answers: AnswersByQuestion
  onRestartSame: () => void
  onBackToSettings: () => void
  onViewHistory: () => void
  onViewLeaderboard: () => void
  onViewOverview: () => void
}

export function StreakResultPage({ links, streakCount, elapsedSeconds, victory, playedQuestions, answers, onRestartSame, onBackToSettings, onViewHistory, onViewLeaderboard, onViewOverview }: StreakResultPageProps) {
  const { t } = useTranslation()
  useEffect(() => { victory ? playVictory() : playFinish() }, [])
  return <section className="results">
    {victory && <Confetti />}
    <div className="score">
      <p>{victory ? t('streak.titleVictory') : t('streak.titleRun')}</p>
      <strong>{streakCount}</strong>
      <span>{t('streak.answersInARow', streakCount)}</span>
      <p className="mention">{victory ? t('streak.mentionVictory') : t('streak.mentionRun')}</p>
      <p className="duration">{t('result.duration', formatDuration(elapsedSeconds))}</p>
    </div>
    <ResultActions onRestartSame={onRestartSame} onBackToSettings={onBackToSettings} />
    <ResultNavLinks onViewHistory={onViewHistory} onViewLeaderboard={onViewLeaderboard} onViewOverview={onViewOverview} />
    <FurtherReading links={links} />
    <CorrectionList items={playedQuestions.map((question) => ({ key: question.id, question, answer: answers[question.id] }))} onRestartSame={onRestartSame} onBackToSettings={onBackToSettings} />
  </section>
}
