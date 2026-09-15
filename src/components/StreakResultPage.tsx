import { useEffect } from 'react'
import type { AnswersByQuestion, Question } from '../types/quiz'
import { useTranslation } from '../i18n'
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
  onViewLeaderboard: () => void
}

export function StreakResultPage({ streakCount, elapsedSeconds, victory, playedQuestions, answers, onRestart, onViewHistory, onViewLeaderboard }: StreakResultPageProps) {
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
    <button type="button" onClick={onRestart}>{t('result.restart')}</button>
    <div className="nav-links">
      <button type="button" className="secondary" onClick={onViewHistory}>{t('common.viewHistory')}</button>
      <button type="button" className="secondary" onClick={onViewLeaderboard}>{t('common.viewLeaderboard')}</button>
    </div>
    <div className="corrections">{playedQuestions.map((question) => {
      const correct = isCorrect(question, answers[question.id])
      return <article className={`correction ${correct ? 'correct' : 'incorrect'}`} key={question.id}>
        <h3>{correct ? t('result.correct') : t('result.incorrect')} — {question.question}</h3>
        {question.imageUrl && <QuestionImage src={question.imageUrl} alt={question.imageAlt} />}
        {question.diagram && <MermaidDiagram chart={question.diagram} />}
        {!correct && <p><strong>{t('result.yourAnswer')}</strong> {userAnswer(question, answers[question.id], t)}</p>}
        {!correct && <p><strong>{t('result.correctAnswerLabel')}</strong> {correctAnswer(question, t)}</p>}
        <p>{question.explanation}</p>
      </article>
    })}</div>
  </section>
}
