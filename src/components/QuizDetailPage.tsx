import { useState } from 'react'
import type { Difficulty, Question, Quiz } from '../types/quiz'
import { useTranslation } from '../i18n'
import { EditQuizMetaForm } from './EditQuizMetaForm'
import { MermaidDiagram } from './MermaidDiagram'
import { PieChart } from './PieChart'
import { createBlankQuestion, QuestionEditForm } from './QuestionEditForm'
import { QuestionImage } from './QuestionImage'
import { QuizAccessManager } from './QuizAccessManager'
import { difficultyLabel, TYPE_ICONS, typeLabel } from './QuizPage'
import { correctAnswer } from './ResultPage'

const THEME_COLORS = ['#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#22d3ee', '#f472b6', '#94a3b8']
const QUESTION_TYPES: Question['type'][] = ['qcm', 'text', 'code', 'ordering', 'boolean', 'cloze', 'matching', 'numeric']
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']
const DIFFICULTY_COLORS: Record<Difficulty, string> = { easy: '#34d399', medium: '#38bdf8', hard: '#fb7185' }

interface QuizDetailPageProps {
  quiz: Quiz
  hostedQuizId: string
  isPublic: boolean
  onTogglePublic: (isPublic: boolean) => void
  onBack: () => void
  onExport: () => void
  isAdmin: boolean
  /** Édition en direct proposée seulement une fois un vrai quiz hébergé chargé (jamais pendant le tout
   * premier affichage, avant que le quiz par défaut n'ait fini de charger — cf. `initialQuiz` dans App.tsx). */
  canEditQuiz: boolean
  onSaveQuestion: (updated: Question) => Promise<void>
  onAddQuestion: (created: Question) => Promise<void>
  onDeleteQuestion: (id: string) => Promise<void>
  editError: string
  onAddTheme: (label: string) => Promise<void>
  quizLoadError: string
  onUpdateQuizMeta: (title: string, author: string, description: string) => Promise<void>
  onDeleteQuiz: (id: string, title: string, deleteHistoryToo: boolean) => Promise<void>
  deleteQuizError: string
}

/** Page d'un seul quiz hébergé : méta, graphiques de répartition, export, visibilité publique, gestion des
 * accès et des questions — tout scopé à ce quiz, plus de sélecteur ni de création ici. */
export function QuizDetailPage({ quiz, hostedQuizId, isPublic, onTogglePublic, onBack, onExport, isAdmin, canEditQuiz, onSaveQuestion, onAddQuestion, onDeleteQuestion, editError, onAddTheme, quizLoadError, onUpdateQuizMeta, onDeleteQuiz, deleteQuizError }: QuizDetailPageProps) {
  const { t } = useTranslation()
  const [deleteHistoryToo, setDeleteHistoryToo] = useState(false)
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
      label: typeLabel(t, type),
      value: quiz.questions.filter((question) => question.type === type).length,
      color: THEME_COLORS[index % THEME_COLORS.length],
    }))
    .filter((slice) => slice.value > 0)

  return <section className="stats-page">
    <div className="stats-header">
      <h2>{quiz.metadata.title}</h2>
      <button type="button" className="secondary" onClick={onBack}>{t('common.back')}</button>
    </div>
    {quizLoadError && <p className="alert" role="alert">{quizLoadError}</p>}
    {quiz.metadata.description && <p className="quiz-description">{quiz.metadata.description}</p>}
    <div className="quiz-detail-actions">
      {canEditQuiz && <EditQuizMetaForm
        title={quiz.metadata.title}
        author={quiz.metadata.author}
        description={quiz.metadata.description ?? ''}
        error={editError}
        onSave={onUpdateQuizMeta}
      />}
      {isAdmin && <button type="button" className="secondary" onClick={onExport}>{t('admin.exportButton')}</button>}
    </div>
    {canEditQuiz && <div className="quiz-detail-actions">
      <label className="theme-checkbox">
        <input type="checkbox" checked={deleteHistoryToo} onChange={(event) => setDeleteHistoryToo(event.target.checked)} />
        {t('admin.deleteHistoryTooLabel')}
      </label>
      <button type="button" className="danger" onClick={() => onDeleteQuiz(hostedQuizId, quiz.metadata.title, deleteHistoryToo)}>{t('admin.deleteQuizButton')}</button>
    </div>}
    {deleteQuizError && <p className="alert" role="alert">{deleteQuizError}</p>}
    <h3 className="stats-group-title">{t('admin.questionBreakdownTitle')}</h3>
    <div className="stats-grid">
      <PieChart title={t('admin.byThemesChartTitle', quiz.questions.length)} data={byTheme} />
      <PieChart title={t('admin.byTypesChartTitle', quiz.questions.length)} data={byType} />
      {quiz.themes.map((theme) => {
        const themeQuestions = quiz.questions.filter((question) => question.theme === theme.id)
        if (!themeQuestions.length) return null
        const byDifficulty = DIFFICULTIES
          .map((difficulty) => ({
            label: difficultyLabel(t, difficulty),
            value: themeQuestions.filter((question) => question.difficulty === difficulty).length,
            color: DIFFICULTY_COLORS[difficulty],
          }))
          .filter((slice) => slice.value > 0)
        return <PieChart key={theme.id} title={t('admin.themeQuestionsChartTitle', theme.label, themeQuestions.length)} data={byDifficulty} />
      })}
    </div>
    {isAdmin && <>
      {hostedQuizId && <>
        <h3 className="stats-group-title profile-section-title">{t('admin.manageAccessTitle')}</h3>
        <QuizAccessManager quiz={{ id: hostedQuizId, title: quiz.metadata.title, is_public: isPublic }} onTogglePublic={onTogglePublic} />
      </>}
      <h3 className="stats-group-title profile-section-title">{t('admin.allQuestionsTitle', quiz.questions.length)}</h3>
      {canEditQuiz && <div className="question-create-bar">
        <input type="text" value={newThemeLabel} onChange={(event) => setNewThemeLabel(event.target.value)} placeholder={t('admin.newThemePlaceholder')} />
        <button type="button" className="secondary" onClick={addTheme} disabled={addingTheme || !newThemeLabel.trim()}>{t('admin.addThemeButton')}</button>
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
          {QUESTION_TYPES.map((type) => <option key={type} value={type}>{TYPE_ICONS[type]} {typeLabel(t, type)}</option>)}
        </select>
        <select value={effectiveCreatingTheme} onChange={(event) => setCreatingTheme(event.target.value)}>
          {quiz.themes.map((theme) => <option key={theme.id} value={theme.id}>{theme.label}</option>)}
        </select>
        <button type="button" onClick={() => setDraftQuestion(createBlankQuestion(creatingType, effectiveCreatingTheme, t('admin.clozeSeedText')))} disabled={!effectiveCreatingTheme}>{t('admin.addQuestionButton')}</button>
      </div>)}
      {quiz.themes.map((theme) => {
        const themeQuestions = quiz.questions.filter((question) => question.theme === theme.id)
        if (!themeQuestions.length) return null
        return <details key={theme.id} className="question-list-group">
          <summary>{t('admin.themeCount', theme.label, themeQuestions.length)}</summary>
          <div className="question-list">
            {themeQuestions.map((question) => <article key={question.id} className="question-list-item">
              <div className="question-meta"><span>{TYPE_ICONS[question.type]} {typeLabel(t, question.type)}</span><span>{difficultyLabel(t, question.difficulty)}</span><span>{t('admin.pointsLabel', question.points)}</span></div>
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
                <p><strong>{t('admin.answerLabel')}</strong> {correctAnswer(question, t)}</p>
                <p className="question-list-explanation">{question.explanation}</p>
                {canEditQuiz && <div className="edit-toggle">
                  <button type="button" className="secondary" onClick={() => setEditingQuestionId(question.id)}>{t('admin.editButton')}</button>
                  <button type="button" className="secondary" onClick={() => onDeleteQuestion(question.id)}>{t('admin.deleteButton')}</button>
                </div>}
              </>}
            </article>)}
          </div>
        </details>
      })}
    </>}
  </section>
}
