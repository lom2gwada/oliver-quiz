import type { AnswersByQuestion, Difficulty, Question, Theme } from '../types/quiz'
import { formatDuration } from '../utils/time'
import { PieChart } from './PieChart'

const DIFFICULTY_LABELS: Record<Difficulty, string> = { easy: 'Facile', medium: 'Intermédiaire', hard: 'Difficile' }

const sameIds = (left: string[], right: string[]) => left.length === right.length && left.every((item) => right.includes(item))

export function isCorrect(question: Question, answer: AnswersByQuestion[string]): boolean {
  if (question.type === 'text') {
    if (typeof answer !== 'string') return false
    const normalize = (value: string) => question.content.caseSensitive ? value.trim() : value.trim().toLocaleLowerCase()
    return question.content.expectedAnswers.map(normalize).includes(normalize(answer))
  }
  if (!Array.isArray(answer)) return false
  if (question.type === 'ordering') return answer.every((id, index) => id === question.content.correctOrder[index]) && answer.length === question.content.correctOrder.length
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
  return <section className="results">
    <div className="score">
      <p>Votre score</p>
      <strong>{score}%</strong>
      <span>{earned} / {total} points</span>
      <p className="mention">{emoji} {label}</p>
      <p className="duration">⏱ Temps : {formatDuration(elapsedSeconds)}</p>
    </div>
    <button type="button" onClick={onRestart}>Recommencer</button>
    <div className="stats-grid">
      {byTheme.map((group) => <PieChart key={`theme-${group.key}`} title={`${group.label} — score`} data={group.data} />)}
      {byDifficulty.map((group) => <PieChart key={`difficulty-${group.key}`} title={`${group.label} — score`} data={group.data} />)}
    </div>
    <div className="corrections">{questions.map((question) => {
      const correct = isCorrect(question, answers[question.id])
      return <article className={`correction ${correct ? 'correct' : 'incorrect'}`} key={question.id}>
        <h3>{correct ? '✓ Bonne réponse' : '✗ Réponse incorrecte'} — {question.question}</h3>
        {!correct && <p><strong>Bonne réponse :</strong> {correctAnswer(question)}</p>}
        <p>{question.explanation}</p>
      </article>
    })}</div>
  </section>
}

function correctAnswer(question: Question): string {
  if (question.type === 'text') return question.content.expectedAnswers.join(' ou ')
  if (question.type === 'ordering') return question.content.correctOrder.map((id) => question.content.items.find((item) => item.id === id)?.label).join(' → ')
  return question.content.answers.filter((answer) => answer.isCorrect).map((answer) => answer.label).join(', ')
}
