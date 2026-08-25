import type { Difficulty, Question, Quiz } from '../types/quiz'
import { PieChart } from './PieChart'
import { TYPE_LABELS } from './QuizPage'

const THEME_COLORS = ['#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#22d3ee', '#f472b6', '#94a3b8']
const QUESTION_TYPES = Object.keys(TYPE_LABELS) as Question['type'][]
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']
const DIFFICULTY_COLORS: Record<Difficulty, string> = { easy: '#34d399', medium: '#38bdf8', hard: '#fb7185' }
const DIFFICULTY_LABELS: Record<Difficulty, string> = { easy: 'Facile', medium: 'Intermédiaire', hard: 'Difficile' }

interface QuizContentPageProps {
  quiz: Quiz
  onBack: () => void
  onFileChange: (file?: File) => void
  fileError: string
}

export function QuizContentPage({ quiz, onBack, onFileChange, fileError }: QuizContentPageProps) {
  const byTheme = quiz.themes
    .map((theme, index) => ({
      label: theme.label,
      value: quiz.questions.filter((question) => question.theme === theme.id).length,
      color: THEME_COLORS[index % THEME_COLORS.length],
    }))
    .filter((slice) => slice.value > 0)

  const byType = QUESTION_TYPES
    .map((type, index) => ({
      label: TYPE_LABELS[type],
      value: quiz.questions.filter((question) => question.type === type).length,
      color: THEME_COLORS[index % THEME_COLORS.length],
    }))
    .filter((slice) => slice.value > 0)

  return <section className="stats-page">
    <div className="stats-header">
      <h2>Quiz</h2>
      <button type="button" className="secondary" onClick={onBack}>Retour</button>
    </div>
    <div className="quiz-import">
      <label className="file-input">Importer un autre quiz (JSON)<input type="file" accept="application/json,.json" onChange={(event) => onFileChange(event.target.files?.[0])} /></label>
      {fileError && <p className="alert" role="alert">{fileError}</p>}
    </div>
    <h3 className="stats-group-title">Répartition des questions</h3>
    <div className="stats-grid">
      <PieChart title={`Thèmes — ${quiz.questions.length} questions`} data={byTheme} />
      <PieChart title={`Types — ${quiz.questions.length} questions`} data={byType} />
      {quiz.themes.map((theme) => {
        const themeQuestions = quiz.questions.filter((question) => question.theme === theme.id)
        if (!themeQuestions.length) return null
        const byDifficulty = DIFFICULTIES
          .map((difficulty) => ({
            label: DIFFICULTY_LABELS[difficulty],
            value: themeQuestions.filter((question) => question.difficulty === difficulty).length,
            color: DIFFICULTY_COLORS[difficulty],
          }))
          .filter((slice) => slice.value > 0)
        return <PieChart key={theme.id} title={`${theme.label} — ${themeQuestions.length} questions`} data={byDifficulty} />
      })}
    </div>
  </section>
}
