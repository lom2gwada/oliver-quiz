import { useEffect, useState } from 'react'
import { CorrectionList } from './CorrectionList'
import type { AnswersByQuestion, Question, Category, QuizLink } from '../types/quiz'
import type { TranslationKey } from '../i18n'
import { useTranslation } from '../i18n'
import { formatPercent } from '../utils/format'
import { formatDuration } from '@engine/utils/time'
import { playFinish, playVictory } from '@engine/utils/sound'
import { Confetti } from '@engine/components/Confetti'
import { PieChart } from '@engine/components/PieChart'
import { FurtherReading } from './FurtherReading'
import { ResultActions } from './ResultActions'
import { ResultNavLinks } from './ResultNavLinks'
import { ReviewSummary } from './ReviewSummary'
import { reviewOutcomes } from '../utils/leitner'
import { isCorrect, type TFunction } from '../utils/answerCheck'

// Réexportés : d'autres écrans importent encore la correction depuis la page de résultat.
export { correctAnswer, isCorrect, userAnswer } from '../utils/answerCheck'
import { difficultyLabel } from './QuizPage'

function correctnessBreakdown<T extends string>(questions: Question[], answers: AnswersByQuestion, keyOf: (question: Question) => T, labelOf: (key: T) => string, t: TFunction) {
  const keys = Array.from(new Set(questions.map(keyOf)))
  return keys.map((key) => {
    const group = questions.filter((question) => keyOf(question) === key)
    const correct = group.filter((question) => isCorrect(question, answers[question.id])).length
    return {
      key,
      label: labelOf(key),
      data: [
        { label: t('result.succeeded'), value: correct, color: '#34d399' },
        { label: t('result.missed'), value: group.length - correct, color: '#fb7185' },
      ].filter((slice) => slice.value > 0),
    }
  })
}

function useAnimatedNumber(target: number, duration = 900): number {
  const [value, setValue] = useState(0)
  useEffect(() => {
    const start = performance.now()
    let frame: number
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - (1 - progress) ** 3
      setValue(Math.round(eased * target))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])
  return value
}

function mention(t: TFunction, score: number): { emoji: string; label: string } {
  if (score >= 90) return { emoji: '🏆', label: t('result.mentionExcellent') }
  if (score >= 75) return { emoji: '👏', label: t('result.mentionGreat') }
  if (score >= 50) return { emoji: '👍', label: t('result.mentionGood') }
  if (score >= 25) return { emoji: '💪', label: t('result.mentionCanDoBetter') }
  return { emoji: '📚', label: t('result.mentionReview') }
}

interface ResultPageProps {
  questions: Question[]
  answers: AnswersByQuestion
  themes: Category[]
  elapsedSeconds: number
  /** Liens « Pour aller plus loin » du quiz (`metadata.links`). */
  links?: QuizLink[]
  /** Présent après une révision : la boîte Leitner de chaque question avant la session, pour montrer ses mouvements. */
  reviewBoxes?: Record<string, number>
  /** Absent après une partie « reprendre mes erreurs » : relancer avec les mêmes paramètres n'a alors pas de sens. */
  onRestartSame?: () => void
  onBackToSettings: () => void
  onViewHistory: () => void
  onViewLeaderboard: () => void
  onViewOverview: () => void
}

export function ResultPage({ links, reviewBoxes, questions, answers, themes, elapsedSeconds, onRestartSame, onBackToSettings, onViewHistory, onViewLeaderboard, onViewOverview }: ResultPageProps) {
  const { t, language } = useTranslation()
  const earned = questions.filter((question) => isCorrect(question, answers[question.id])).reduce((total, question) => total + question.points, 0)
  const total = questions.reduce((sum, question) => sum + question.points, 0)
  const score = total ? Math.round((earned / total) * 100) : 0
  const { emoji, label } = mention(t, score)
  const byTheme = correctnessBreakdown(questions, answers, (question) => question.category, (id) => themes.find((theme) => theme.id === id)?.label ?? id, t)
  const byDifficulty = correctnessBreakdown(questions, answers, (question) => question.difficulty, (difficulty) => difficultyLabel(t, difficulty), t)
  const displayScore = useAnimatedNumber(score)
  useEffect(() => { score >= 90 ? playVictory() : playFinish() }, [])
  return <section className="results">
    {score >= 90 && <Confetti />}
    <div className="score">
      <p>{t('result.yourScore')}</p>
      <strong>{formatPercent(displayScore, language)}</strong>
      <span>{t('result.pointsEarned', earned, total)}</span>
      <p className="mention">{emoji} {label}</p>
      <p className="duration">{t('result.duration', formatDuration(elapsedSeconds))}</p>
    </div>
    {reviewBoxes && <ReviewSummary outcomes={reviewOutcomes(questions, answers, reviewBoxes)} />}
    <ResultActions onRestartSame={onRestartSame} onBackToSettings={onBackToSettings} />
    <ResultNavLinks onViewHistory={onViewHistory} onViewLeaderboard={onViewLeaderboard} onViewOverview={onViewOverview} />
    <FurtherReading links={links} />
    <details className="result-breakdown">
      <summary>{t('result.breakdownTitle')}</summary>
      <div className="stats-groups">
      <div className="stats-group">
        <h3 className="stats-group-title">{t('result.byTheme')}</h3>
        <div className="stats-grid">{byTheme.map((group) => <PieChart key={`theme-${group.key}`} title={`${group.label} — score`} data={group.data} />)}</div>
      </div>
      <div className="stats-group">
        <h3 className="stats-group-title">{t('result.byDifficulty')}</h3>
        <div className="stats-grid">{byDifficulty.map((group) => <PieChart key={`difficulty-${group.key}`} title={`${group.label} — score`} data={group.data} />)}</div>
      </div>
      </div>
    </details>
    <CorrectionList items={questions.map((question) => ({ key: question.id, question, answer: answers[question.id] }))} onRestartSame={onRestartSame} onBackToSettings={onBackToSettings} />
  </section>
}

