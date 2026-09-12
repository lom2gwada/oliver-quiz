import { useState } from 'react'
import type { Difficulty, Question, Quiz } from '../types/quiz'
import type { HostedQuizSummary } from '../types/hostedQuiz'
import { CreateQuizForm } from './CreateQuizForm'
import { MermaidDiagram } from './MermaidDiagram'
import { PieChart } from './PieChart'
import { createBlankQuestion, QuestionEditForm } from './QuestionEditForm'
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
  onAddQuestion: (created: Question) => Promise<void>
  onDeleteQuestion: (id: string) => Promise<void>
  editError: string
  onCreateQuiz: (title: string, author: string, description: string, themeLabels: string[]) => Promise<void>
  createError: string
  onAddTheme: (label: string) => Promise<void>
}

export function QuizContentPage({ quiz, hostedQuizzes, onBack, onPublish, onExport, publishError, publishSuccess, isAdmin, canEditQuiz, onSaveQuestion, onAddQuestion, onDeleteQuestion, editError, onCreateQuiz, createError, onAddTheme }: QuizContentPageProps) {
  const [editingQuestionId, setEditingQuestionId] = useState('')
  const [creatingType, setCreatingType] = useState<Question['type']>('qcm')
  const [creatingTheme, setCreatingTheme] = useState(quiz.themes[0]?.id ?? '')
  // `creatingTheme` peut devenir obsolète (thème d'un quiz précédent, ou d'avant l'ajout d'un thème) sans que ce
  // composant ne se démonte — on retombe alors sur le premier thème du quiz actif plutôt que de fabriquer une
  // question référençant un thème qui n'existe plus (ce que `parseQuiz` rejetterait à l'enregistrement).
  const effectiveCreatingTheme = quiz.themes.some((theme) => theme.id === creatingTheme) ? creatingTheme : (quiz.themes[0]?.id ?? '')
  const [draftQuestion, setDraftQuestion] = useState<Question | null>(null)
  const [newThemeLabel, setNewThemeLabel] = useState('')
  const [addingTheme, setAddingTheme] = useState(false)
  const addTheme = async () => {
    setAddingTheme(true)
    try { await onAddTheme(newThemeLabel.trim()); setNewThemeLabel('') } catch { /* editError affiché ci-dessous */ } finally { setAddingTheme(false) }
  }
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
      <h3 className="stats-group-title profile-section-title">Créer un quiz</h3>
      <CreateQuizForm error={createError} onCreate={onCreateQuiz} />
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
      {canEditQuiz && <div className="question-create-bar">
        <input type="text" value={newThemeLabel} onChange={(event) => setNewThemeLabel(event.target.value)} placeholder="Nom du nouveau thème" />
        <button type="button" className="secondary" onClick={addTheme} disabled={addingTheme || !newThemeLabel.trim()}>➕ Ajouter un thème</button>
      </div>}
      {canEditQuiz && editError && !draftQuestion && !editingQuestionId && <p className="alert" role="alert">{editError}</p>}
      {canEditQuiz && (draftQuestion ? <QuestionEditForm
        question={draftQuestion}
        themes={quiz.themes}
        error={editError}
        onCancel={() => setDraftQuestion(null)}
        onSave={async (created) => { try { await onAddQuestion(created); setDraftQuestion(null) } catch { /* editError affiché dans le formulaire */ } }}
      /> : <div className="question-create-bar">
        <select value={creatingType} onChange={(event) => setCreatingType(event.target.value as Question['type'])}>
          {QUESTION_TYPES.map((type) => <option key={type} value={type}>{TYPE_ICONS[type]} {TYPE_LABELS[type]}</option>)}
        </select>
        <select value={effectiveCreatingTheme} onChange={(event) => setCreatingTheme(event.target.value)}>
          {quiz.themes.map((theme) => <option key={theme.id} value={theme.id}>{theme.label}</option>)}
        </select>
        <button type="button" onClick={() => setDraftQuestion(createBlankQuestion(creatingType, effectiveCreatingTheme))} disabled={!effectiveCreatingTheme}>➕ Ajouter une question</button>
      </div>)}
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
                {canEditQuiz && <div className="edit-toggle">
                  <button type="button" className="secondary" onClick={() => setEditingQuestionId(question.id)}>✏️ Modifier</button>
                  <button type="button" className="secondary" onClick={() => onDeleteQuestion(question.id)}>🗑️ Supprimer</button>
                </div>}
              </>}
            </article>)}
          </div>
        </details>
      })}
    </>}
  </section>
}
