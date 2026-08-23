import { useEffect, useState } from 'react'
import type { AnswersByQuestion, Difficulty, Question, Theme } from '../types/quiz'
import { formatDuration } from '../utils/time'
import { playFinish, playVictory } from '../utils/sound'
import { Confetti } from './Confetti'
import { PieChart } from './PieChart'

export const DIFFICULTY_LABELS: Record<Difficulty, string> = { easy: 'Facile', medium: 'Intermédiaire', hard: 'Difficile' }

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

function correctnessBreakdown<T extends string>(questions: Question[], answers: AnswersByQuestion, keyOf: (question: Question) => T, labelOf: (key: T) => string) {
  const keys = Array.from(new Set(questions.map(keyOf)))
  return keys.map((key) => {
    const group = questions.filter((question) => keyOf(question) === key)
    const correct = group.filter((question) => isCorrect(question, answers[question.id])).length
    return {
      key,
      label: labelOf(key),
      data: [
        { label: 'Réussi', value: correct, color: '#34d399' },
        { label: 'Raté', value: group.length - correct, color: '#fb7185' },
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

function mention(score: number): { emoji: string; label: string } {
  if (score >= 90) return { emoji: '🏆', label: 'Excellent' }
  if (score >= 75) return { emoji: '👏', label: 'Très bien' }
  if (score >= 50) return { emoji: '👍', label: 'Bien' }
  if (score >= 25) return { emoji: '💪', label: 'Peut mieux faire' }
  return { emoji: '📚', label: 'À revoir' }
}

interface ResultPageProps {
  questions: Question[]
  answers: AnswersByQuestion
  themes: Theme[]
  elapsedSeconds: number
  onRestart: () => void
}

export function ResultPage({ questions, answers, themes, elapsedSeconds, onRestart }: ResultPageProps) {
  const earned = questions.filter((question) => isCorrect(question, answers[question.id])).reduce((total, question) => total + question.points, 0)
  const total = questions.reduce((sum, question) => sum + question.points, 0)
  const score = total ? Math.round((earned / total) * 100) : 0
  const { emoji, label } = mention(score)
  const byTheme = correctnessBreakdown(questions, answers, (question) => question.theme, (id) => themes.find((theme) => theme.id === id)?.label ?? id)
  const byDifficulty = correctnessBreakdown(questions, answers, (question) => question.difficulty, (difficulty) => DIFFICULTY_LABELS[difficulty])
  const displayScore = useAnimatedNumber(score)
  useEffect(() => { score >= 90 ? playVictory() : playFinish() }, [])
  return <section className="results">
    {score >= 90 && <Confetti />}
    <div className="score">
      <p>Votre score</p>
      <strong>{displayScore}%</strong>
      <span>{earned} / {total} points</span>
      <p className="mention">{emoji} {label}</p>
      <p className="duration">⏱ Temps : {formatDuration(elapsedSeconds)}</p>
    </div>
    <button type="button" onClick={onRestart}>Recommencer</button>
    <div className="stats-groups">
      <div className="stats-group">
        <h3 className="stats-group-title">Par thème</h3>
        <div className="stats-grid">{byTheme.map((group) => <PieChart key={`theme-${group.key}`} title={`${group.label} — score`} data={group.data} />)}</div>
      </div>
      <div className="stats-group">
        <h3 className="stats-group-title">Par difficulté</h3>
        <div className="stats-grid">{byDifficulty.map((group) => <PieChart key={`difficulty-${group.key}`} title={`${group.label} — score`} data={group.data} />)}</div>
      </div>
    </div>
    <div className="corrections">{questions.map((question) => {
      const correct = isCorrect(question, answers[question.id])
      return <article className={`correction ${correct ? 'correct' : 'incorrect'}`} key={question.id}>
        <h3>{correct ? '✓ Bonne réponse' : '✗ Réponse incorrecte'} — {question.question}</h3>
        {!correct && <p><strong>Votre réponse :</strong> {userAnswer(question, answers[question.id])}</p>}
        {!correct && <p><strong>Bonne réponse :</strong> {correctAnswer(question)}</p>}
        <p>{question.explanation}</p>
      </article>
    })}</div>
  </section>
}

export function userAnswer(question: Question, answer: AnswersByQuestion[string] | undefined): string {
  if (question.type === 'text' || question.type === 'cloze') return typeof answer === 'string' && answer.trim() ? answer : 'Aucune réponse'
  if (question.type === 'numeric') {
    if (typeof answer !== 'string' || answer === '') return 'Aucune réponse'
    const suffix = question.content.unit ? ` ${question.content.unit}` : ''
    return `${answer}${suffix}`
  }
  if (!Array.isArray(answer) || !answer.length) return 'Aucune réponse'
  if (question.type === 'ordering') return answer.map((id) => question.content.items.find((item) => item.id === id)?.label).join(' → ')
  if (question.type === 'boolean') return answer[0] === 'true' ? 'Vrai' : 'Faux'
  if (question.type === 'matching') {
    const pairs = answer.map((token) => {
      const [leftId, rightId] = token.split(':')
      const left = question.content.left.find((item) => item.id === leftId)
      const right = question.content.right.find((item) => item.id === rightId)
      return left && right ? `${left.label} → ${right.label}` : null
    }).filter(Boolean)
    return pairs.length ? pairs.join(', ') : 'Aucune réponse'
  }
  return answer.map((id) => question.content.answers.find((item) => item.id === id)?.label).join(', ')
}

export function correctAnswer(question: Question): string {
  if (question.type === 'text' || question.type === 'cloze') return question.content.expectedAnswers.join(' ou ')
  if (question.type === 'numeric') {
    const { target, tolerance, unit } = question.content
    const suffix = unit ? ` ${unit}` : ''
    return tolerance > 0 ? `${target}${suffix} (± ${tolerance}${suffix})` : `${target}${suffix}`
  }
  if (question.type === 'ordering') return question.content.correctOrder.map((id) => question.content.items.find((item) => item.id === id)?.label).join(' → ')
  if (question.type === 'boolean') return question.content.isTrue ? 'Vrai' : 'Faux'
  if (question.type === 'matching') {
    return question.content.left.map((left) => {
      const right = question.content.right.find((item) => item.id === question.content.correctPairs[left.id])
      return `${left.label} → ${right?.label ?? '?'}`
    }).join(', ')
  }
  return question.content.answers.filter((answer) => answer.isCorrect).map((answer) => answer.label).join(', ')
}
