import type { HostedQuizSummary } from '../types/hostedQuiz'
import { useTranslation } from '../i18n'
import { CreateQuizForm } from './CreateQuizForm'

interface QuizListPageProps {
  hostedQuizzes: HostedQuizSummary[]
  isAdmin: boolean
  onBack: () => void
  onSelectQuiz: (id: string) => void
  onCreateQuiz: (title: string, author: string, description: string, themeLabels: string[]) => Promise<void>
  createError: string
  onPublish: (file?: File) => void
  publishError: string
  publishSuccess: boolean
}

/** Page générale : liste (tuiles) des quiz hébergés, création et import/mise à jour par JSON.
 * Cliquer une tuile sélectionne ce quiz comme quiz actif puis navigue vers `QuizDetailPage`. */
export function QuizListPage({ hostedQuizzes, isAdmin, onBack, onSelectQuiz, onCreateQuiz, createError, onPublish, publishError, publishSuccess }: QuizListPageProps) {
  const { t } = useTranslation()
  return <section className="stats-page">
    <div className="stats-header">
      <h2>{t('start.quizLabel')}</h2>
      <button type="button" className="secondary" onClick={onBack}>{t('common.back')}</button>
    </div>
    <h3 className="stats-group-title">{t('admin.hostedQuizzesTitle')}</h3>
    {hostedQuizzes.length === 0
      ? <p>{t('admin.noPublishedQuiz')}</p>
      : <div className="quiz-tile-grid">
        {hostedQuizzes.map((hosted) => <button type="button" key={hosted.id} className="quiz-tile" onClick={() => onSelectQuiz(hosted.id)}>
          {hosted.title}
        </button>)}
      </div>}
    {isAdmin && <>
      <h3 className="stats-group-title profile-section-title">{t('admin.createQuizTitle')}</h3>
      <CreateQuizForm error={createError} onCreate={onCreateQuiz} />
      <h3 className="stats-group-title profile-section-title">{t('admin.publishQuizTitle')}</h3>
      <div className="quiz-import">
        <label className="file-input">{t('admin.importLabel')}<input type="file" accept="application/json,.json" onChange={(event) => onPublish(event.target.files?.[0])} /></label>
        {publishError && <p className="alert" role="alert">{publishError}</p>}
        {publishSuccess && <p className="profile-saved">{t('admin.publishSuccess')}</p>}
      </div>
    </>}
  </section>
}
