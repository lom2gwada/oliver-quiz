import type { HostedQuizSummary } from '../types/hostedQuiz'
import { useTranslation } from '../i18n'
import { CreateQuizForm } from './CreateQuizForm'
import { ABOUT } from '../config/about'
import { buildQuizTemplate, QUIZ_TEMPLATE_FILENAME } from '../utils/quizTemplate'

interface QuizListPageProps {
  hostedQuizzes: HostedQuizSummary[]
  isAdmin: boolean
  onBack: () => void
  onSelectQuiz: (id: string) => void
  onCreateQuiz: (title: string, author: string, description: string, themeLabels: string[], language: string) => Promise<void>
  createError: string
  onPublish: (file?: File) => void
  publishError: string
  publishSuccess: boolean
  /** Avertissement non bloquant après un import réussi (ex. langue du quiz non reconnue). */
  publishWarning: string
}

/** Où le format d'un fichier de quiz est décrit : la section « Format d'un quiz JSON » du README du dépôt public. */
const FORMAT_DOC_URL = `${ABOUT.repoUrl}#format-dun-quiz-json`

/** Télécharge un quiz modèle (une question de chaque type) dans la langue de l'interface. */
function downloadTemplate(language: Parameters<typeof buildQuizTemplate>[0]): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(buildQuizTemplate(language), null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = QUIZ_TEMPLATE_FILENAME
  link.click()
  URL.revokeObjectURL(url)
}

/** Page générale : liste (tuiles) des quiz hébergés, création et import/mise à jour par JSON.
 * Cliquer une tuile sélectionne ce quiz comme quiz actif puis navigue vers `QuizDetailPage`. */
export function QuizListPage({ hostedQuizzes, isAdmin, onBack, onSelectQuiz, onCreateQuiz, createError, onPublish, publishError, publishSuccess, publishWarning }: QuizListPageProps) {
  const { t, language } = useTranslation()
  return <section className="stats-page">
    <div className="stats-header">
      <h2>{t('nav.admin')}</h2>
      <button type="button" className="secondary" onClick={onBack}>{t('common.back')}</button>
    </div>
    <h3 className="stats-group-title">{t('admin.hostedQuizzesTitle')}</h3>
    {hostedQuizzes.length === 0
      ? <p>{t('admin.noPublishedQuiz')}</p>
      : <div className="quiz-tile-grid">
        {hostedQuizzes.map((hosted) => <button type="button" key={hosted.id} className="quiz-tile" onClick={() => onSelectQuiz(hosted.id)}>
          {hosted.title}{hosted.is_public && <span className="quiz-tile-badge"> {t('admin.publicQuizBadge')}</span>}
        </button>)}
      </div>}
    {isAdmin && <>
      <h3 className="stats-group-title profile-section-title">{t('admin.createQuizTitle')}</h3>
      <CreateQuizForm error={createError} onCreate={onCreateQuiz} />
      <h3 className="stats-group-title profile-section-title">{t('admin.publishQuizTitle')}</h3>
      <div className="quiz-import">
        <label className="file-input">{t('admin.importLabel')}<input type="file" accept="application/json,.json" onChange={(event) => onPublish(event.target.files?.[0])} /></label>
        <div className="quiz-import-help">
          <a href={FORMAT_DOC_URL} target="_blank" rel="noopener noreferrer">{t('admin.formatLink')}</a>
          <button type="button" className="secondary" onClick={() => downloadTemplate(language)}>{t('admin.templateButton')}</button>
        </div>
        {publishError && <p className="alert" role="alert">{publishError}</p>}
        {publishSuccess && <p className="profile-saved">{t('admin.publishSuccess')}</p>}
        {publishSuccess && publishWarning && <p className="mode-hint" role="status">{publishWarning}</p>}
      </div>
    </>}
  </section>
}
