import { useEffect, useState } from 'react'
import type { AnswersByQuestion, Difficulty, Question, Theme } from '../types/quiz'
import type { TranslationKey } from '../i18n'
import { translate, useTranslation } from '../i18n'
import { formatDuration } from '../utils/time'
import { playFinish, playVictory } from '../utils/sound'
import { Confetti } from './Confetti'
import { MermaidDiagram } from './MermaidDiagram'
import { PieChart } from './PieChart'
import { QuestionImage } from './QuestionImage'
import { difficultyLabel } from './QuizPage'

/** @deprecated Chaînes françaises figées, gardées le temps que `HistoryPage.tsx` (qui l'importe encore)
 * migre vers `difficultyLabel(t, difficulty)` (voir `QuizPage.tsx`) dans une PR i18n suivante. */
export const DIFFICULTY_LABELS: Record<Difficulty, string> = { easy: 'Facile', medium: 'Intermédiaire', hard: 'Difficile' }

type TFunction = (key: TranslationKey, ...args: unknown[]) => string
/** Traducteur français par défaut : `userAnswer`/`correctAnswer` sont appelées par des écrans pas encore
 * migrés (ex. `QuizContentPage.tsx`) qui ne passent pas de `t` — ce défaut préserve exactement le
 * comportement (et les chaînes) d'avant l'i18n pour ces appelants, sans les forcer à être touchés ici. */
const defaultT: TFunction = (key, ...args) => translate('fr', key, ...args)

const sameIds = (left: string[], right: string[]) => left.length === right.length && left.every((item) => right.includes(item))

export function isCorrect(question: Question, answer: AnswersByQuestion[string] | undefined): boolean {
  if (question.type === 'text' || question.type === 'cloze') {
    if (typeof answer !== 'string') return false
    const normalize = (value: string) => question.content.caseSensitive ? value.trim() : value.trim().toLocaleLowerCase()
    return question.content.expectedAnswers.map(normalize).includes(normalize(answer))
  }
  if (question.type === 'numeric') {
    if (typeof answer !== 'string' || answer === '') return false
    const value = Number(answer)
    return Number.isFinite(value) && Math.abs(value - question.content.target) <= question.content.tolerance
  }
  if (!Array.isArray(answer)) return false
  if (question.type === 'ordering') return answer.every((id, index) => id === question.content.correctOrder[index]) && answer.length === question.content.correctOrder.length
  if (question.type === 'boolean') return answer[0] === String(question.content.isTrue)
  if (question.type === 'matching') {
    const expected = question.content.correctPairs
    const given: Record<string, string> = {}
    answer.forEach((token) => {
      const [left, right] = token.split(':')
      if (left && right) given[left] = right
    })
    const keys = Object.keys(expected)
    return keys.length === Object.keys(given).length && keys.every((left) => given[left] === expected[left])
  }
  return sameIds(answer, question.content.answers.filter((item) => item.isCorrect).map((item) => item.id))
}

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
  themes: Theme[]
  elapsedSeconds: number
  onRestart: () => void
  onViewHistory: () => void
  onViewLeaderboard: () => void
}

export function ResultPage({ questions, answers, themes, elapsedSeconds, onRestart, onViewHistory, onViewLeaderboard }: ResultPageProps) {
  const { t } = useTranslation()
  const earned = questions.filter((question) => isCorrect(question, answers[question.id])).reduce((total, question) => total + question.points, 0)
  const total = questions.reduce((sum, question) => sum + question.points, 0)
  const score = total ? Math.round((earned / total) * 100) : 0
  const { emoji, label } = mention(t, score)
  const byTheme = correctnessBreakdown(questions, answers, (question) => question.theme, (id) => themes.find((theme) => theme.id === id)?.label ?? id, t)
  const byDifficulty = correctnessBreakdown(questions, answers, (question) => question.difficulty, (difficulty) => difficultyLabel(t, difficulty), t)
  const displayScore = useAnimatedNumber(score)
  useEffect(() => { score >= 90 ? playVictory() : playFinish() }, [])
  return <section className="results">
    {score >= 90 && <Confetti />}
    <div className="score">
      <p>{t('result.yourScore')}</p>
      <strong>{displayScore}%</strong>
      <span>{t('result.pointsEarned', earned, total)}</span>
      <p className="mention">{emoji} {label}</p>
      <p className="duration">{t('result.duration', formatDuration(elapsedSeconds))}</p>
    </div>
    <button type="button" onClick={onRestart}>{t('result.restart')}</button>
    <div className="nav-links">
      <button type="button" className="secondary" onClick={onViewHistory}>{t('common.viewHistory')}</button>
      <button type="button" className="secondary" onClick={onViewLeaderboard}>{t('common.viewLeaderboard')}</button>
    </div>
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
    <div className="corrections">{questions.map((question) => {
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

export function userAnswer(question: Question, answer: AnswersByQuestion[string] | undefined, t: TFunction = defaultT): string {
  if (question.type === 'text' || question.type === 'cloze') return typeof answer === 'string' && answer.trim() ? answer : t('quiz.noAnswer')
  if (question.type === 'numeric') {
    if (typeof answer !== 'string' || answer === '') return t('quiz.noAnswer')
    const suffix = question.content.unit ? ` ${question.content.unit}` : ''
    return `${answer}${suffix}`
  }
  if (!Array.isArray(answer) || !answer.length) return t('quiz.noAnswer')
  if (question.type === 'ordering') return answer.map((id) => question.content.items.find((item) => item.id === id)?.label).join(' → ')
  if (question.type === 'boolean') return answer[0] === 'true' ? t('quiz.true') : t('quiz.false')
  if (question.type === 'matching') {
    const pairs = answer.map((token) => {
      const [leftId, rightId] = token.split(':')
      const left = question.content.left.find((item) => item.id === leftId)
      const right = question.content.right.find((item) => item.id === rightId)
      return left && right ? `${left.label} → ${right.label}` : null
    }).filter(Boolean)
    return pairs.length ? pairs.join(', ') : t('quiz.noAnswer')
  }
  return answer.map((id) => question.content.answers.find((item) => item.id === id)?.label).join(', ')
}

export function correctAnswer(question: Question, t: TFunction = defaultT): string {
  if (question.type === 'text' || question.type === 'cloze') return question.content.expectedAnswers.join(t('quiz.orSeparator'))
  if (question.type === 'numeric') {
    const { target, tolerance, unit } = question.content
    const suffix = unit ? ` ${unit}` : ''
    return tolerance > 0 ? `${target}${suffix} (± ${tolerance}${suffix})` : `${target}${suffix}`
  }
  if (question.type === 'ordering') return question.content.correctOrder.map((id) => question.content.items.find((item) => item.id === id)?.label).join(' → ')
  if (question.type === 'boolean') return question.content.isTrue ? t('quiz.true') : t('quiz.false')
  if (question.type === 'matching') {
    return question.content.left.map((left) => {
      const right = question.content.right.find((item) => item.id === question.content.correctPairs[left.id])
      return `${left.label} → ${right?.label ?? '?'}`
    }).join(', ')
  }
  return question.content.answers.filter((answer) => answer.isCorrect).map((answer) => answer.label).join(', ')
}
