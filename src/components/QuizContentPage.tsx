import { useState } from 'react'
import type { Difficulty, Question, Quiz } from '../types/quiz'
import type { HostedQuizSummary } from '../types/hostedQuiz'
import { MermaidDiagram } from './MermaidDiagram'
import { PieChart } from './PieChart'
import { QuestionEditForm } from './QuestionEditForm'
import { QuestionImage } from './QuestionImage'
import { QuizAccessManager } from './QuizAccessManager'
import { TYPE_ICONS, TYPE_LABELS } from './QuizPage'
import { correctAnswer } from './ResultPage'

const THEME_COLORS = ['#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#22d3ee', '#f472b6', '#94a3b8']
const QUESTION_TYPES = Object.keys(TYPE_LABELS) as Question['type'][]
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']
const DIFFICULTY_COLORS: Record<Difficulty, string> = { easy: '#34d399', medium: '#38bdf8', hard: '#fb7185' }
const DIFFICULTY_LABELS: Record<Difficulty, string> = { easy: 'Facile', medium: 'Intermédiaire', hard: 'Difficile' }

interface QuizContentPageProps {
  quiz: Quiz
  hostedQuizzes: HostedQuizSummary[]
  onBack: () => void
  onPublish: (file?: File) => void
  onExport: () => void
  publishError: string
  publishSuccess: boolean
  isAdmin: boolean
  /** Édition en direct proposée seulement pour un quiz hébergé actif — jamais pour le quiz d'exemple. */
  canEditQuiz: boolean
  onSaveQuestion: (updated: Question) => Promise<void>
  editError: string
}

export function QuizContentPage({ quiz, hostedQuizzes, onBack, onPublish, onExport, publishError, publishSuccess, isAdmin, canEditQuiz, onSaveQuestion, editError }: QuizContentPageProps) {
  const [editingQuestionId, setEditingQuestionId] = useState('')
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
    {quiz.metadata.description && <p className="quiz-description">{quiz.metadata.description}</p>}
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
    {isAdmin && <>
      <h3 className="stats-group-title profile-section-title">Publier un quiz</h3>
      <div className="quiz-import">
        <label className="file-input">Importer / mettre à jour un quiz (JSON)<input type="file" accept="application/json,.json" onChange={(event) => onPublish(event.target.files?.[0])} /></label>
        <button type="button" className="secondary" onClick={onExport}>Exporter ce quiz (JSON)</button>
        {publishError && <p className="alert" role="alert">{publishError}</p>}
        {publishSuccess && <p className="profile-saved">Quiz publié — aucun accès n'est accordé automatiquement.</p>}
      </div>
      <h3 className="stats-group-title profile-section-title">Gérer les accès</h3>
      <QuizAccessManager quizzes={hostedQuizzes} />
      <h3 className="stats-group-title profile-section-title">Toutes les questions ({quiz.questions.length})</h3>
      {quiz.themes.map((theme) => {
        const themeQuestions = quiz.questions.filter((question) => question.theme === theme.id)
        if (!themeQuestions.length) return null
        return <details key={theme.id} className="question-list-group">
          <summary>{theme.label} ({themeQuestions.length})</summary>
          <div className="question-list">
            {themeQuestions.map((question) => <article key={question.id} className="question-list-item">
              <div className="question-meta"><span>{TYPE_ICONS[question.type]} {TYPE_LABELS[question.type]}</span><span>{DIFFICULTY_LABELS[question.difficulty]}</span><span>{question.points} pts</span></div>
              {editingQuestionId === question.id ? <QuestionEditForm
                question={question}
                themes={quiz.themes}
                error={editError}
                onCancel={() => setEditingQuestionId('')}
                onSave={async (updated) => { try { await onSaveQuestion(updated); setEditingQuestionId('') } catch { /* editError affiché par le parent, formulaire laissé ouvert */ } }}
              /> : <>
                <p className="question-list-prompt">{question.question}</p>
                {question.imageUrl && <QuestionImage src={question.imageUrl} alt={question.imageAlt} />}
                {question.diagram && <MermaidDiagram chart={question.diagram} />}
                <p><strong>Réponse :</strong> {correctAnswer(question)}</p>
                <p className="question-list-explanation">{question.explanation}</p>
                {canEditQuiz && <button type="button" className="secondary edit-toggle" onClick={() => setEditingQuestionId(question.id)}>✏️ Modifier</button>}
              </>}
            </article>)}
          </div>
        </details>
      })}
    </>}
  </section>
}
