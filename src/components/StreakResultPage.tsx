import { useEffect } from 'react'
import { CorrectionExplanation } from './CorrectionExplanation'
import type { AnswersByQuestion, Question, QuizLink } from '../types/quiz'
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
}

export function StreakResultPage({ links, streakCount, elapsedSeconds, victory, playedQuestions, answers, onRestartSame, onBackToSettings, onViewHistory, onViewLeaderboard }: StreakResultPageProps) {
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
    <div className="nav-links">
      <button type="button" className="secondary" onClick={onViewHistory}>{t('common.viewHistory')}</button>
      <button type="button" className="secondary" onClick={onViewLeaderboard}>{t('common.viewLeaderboard')}</button>
    </div>
    <FurtherReading links={links} />
    <div className="corrections">{playedQuestions.map((question) => {
      const correct = isCorrect(question, answers[question.id])
      return <article className={`correction ${correct ? 'correct' : 'incorrect'}`} key={question.id}>
        <h3>{correct ? t('result.correct') : t('result.incorrect')} — {question.question}</h3>
        {question.imageUrl && <QuestionImage src={question.imageUrl} alt={question.imageAlt} />}
        {question.diagram && <MermaidDiagram chart={question.diagram} />}
        {question.table && <QuestionTable table={question.table} />}
        {!correct && <p><strong>{t('result.yourAnswer')}</strong> {userAnswer(question, answers[question.id], t)}</p>}
        {!correct && <p><strong>{t('result.correctAnswerLabel')}</strong> {correctAnswer(question, t)}</p>}
        <CorrectionExplanation text={question.explanation} />
        <QuestionReplay question={question} answer={answers[question.id]} />
      </article>
    })}</div>
  </section>
}
