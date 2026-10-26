import { useEffect, useState } from 'react'
import { useTranslation } from '../i18n'
import { CoverageBar } from './CoverageBar'
import { coveragePercentTenths, coverageTotals, fetchQuizCoverage, REVIEW_BATCH_SIZE, splitCoverage, type QuizCoverage } from '../utils/coverage'
import { longDate } from '../utils/dateFormat'
import { formatPercent } from '../utils/format'

interface OverviewPageProps {
  /** Sélectionne le quiz cliqué comme quiz actif et revient à l'accueil, prêt à le lancer. */
  onSelectQuiz: (quizId: string) => void
  /** Charge le quiz et lance une session sur ses cartes Leitner échues ; rejette si le chargement échoue. */
  onReviewQuiz: (quizId: string) => Promise<void>
  /** Sélectionne le quiz puis ouvre son historique ; « Retour » ramène ici. */
  onViewHistory: (quizId: string) => void
  /** Sélectionne le quiz puis ouvre son classement ; « Retour » ramène ici. */
  onViewLeaderboard: (quizId: string) => void
  onBack: () => void
}

export function OverviewPage({ onSelectQuiz, onReviewQuiz, onViewHistory, onViewLeaderboard, onBack }: OverviewPageProps) {
  const { t, language } = useTranslation()
  const [rows, setRows] = useState<QuizCoverage[] | null>(null)
  const [error, setError] = useState(false)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewError, setReviewError] = useState(false)

  const load = () => {
    setError(false)
    fetchQuizCoverage().then(setRows).catch(() => setError(true))
  }
  useEffect(load, [])

  const review = async (quizId: string) => {
    setReviewError(false)
    setReviewingId(quizId)
    try {
      await onReviewQuiz(quizId)
    } catch {
      setReviewError(true)
      setReviewingId(null)
    }
  }

  const { started, untouched } = splitCoverage(rows ?? [])
  const totals = coverageTotals(started)

  return <section className="stats-page">
    <div className="stats-header">
      <h2>{t('overview.title')}</h2>
      <button type="button" className="secondary" onClick={onBack}>{t('common.back')}</button>
    </div>
    {error && <p className="alert" role="alert">{t('overview.errorLoad')} <button type="button" className="secondary alert-retry" onClick={load}>{t('start.retry')}</button></p>}
    {reviewError && <p className="alert" role="alert">{t('overview.errorReview')}</p>}
    {!rows && !error && <p>{t('common.loading')}</p>}
    {rows && !started.length && <p>{t('overview.emptyState')}</p>}
    {started.length > 0 && <>
      <div className="overview-summary">
        <strong>{t('overview.summary', started.length, totals.seen, totals.total)}</strong>
        <CoverageBar percent={totals.percent} label={t('overview.summaryBarLabel')} />
      </div>
      <ul className="overview-list">
        {started.map((row) => {
          const percent = coveragePercentTenths(row.seen_count, row.question_count)
          const batch = Math.min(row.due_count, REVIEW_BATCH_SIZE)
          return <li key={row.quiz_id} className="overview-card">
            <button type="button" className="overview-item" onClick={() => onSelectQuiz(row.quiz_id)}>
              <span className="overview-item-head">
                <span className="overview-item-title">{row.quiz_title}</span>
                <span className="overview-item-percent" title={t('metric.discoveredHint')}>{formatPercent(percent, language, 1)} <small className="overview-item-percent-label">{t('metric.discoveredShort')}</small></span>
              </span>
              <CoverageBar percent={percent} label={`${row.quiz_title} — ${t('metric.discovered', formatPercent(percent, language, 1))}`} />
              <span className="overview-item-meta">
                {t('overview.seen', row.seen_count, row.question_count)} · {t('overview.games', row.games_played)}
                {row.last_played_at && <> · {t('overview.lastPlayed', longDate(row.last_played_at, language))}</>}
              </span>
            </button>
            <div className="overview-review">
              {batch > 0 && <button type="button" className="secondary" disabled={reviewingId !== null} onClick={() => review(row.quiz_id)}>{reviewingId === row.quiz_id ? t('common.loading') : t('overview.review', batch)}</button>}
              <button type="button" className="secondary" disabled={reviewingId !== null} onClick={() => onViewHistory(row.quiz_id)}>{t('overview.history')}</button>
              <button type="button" className="secondary" disabled={reviewingId !== null} onClick={() => onViewLeaderboard(row.quiz_id)}>{t('overview.leaderboard')}</button>
              <span className="overview-item-meta">{batch > 0 ? t('overview.dueNote', row.due_count) : t('overview.nothingDue')}</span>
            </div>
          </li>
        })}
      </ul>
    </>}
    {untouched.length > 0 && <>
      <h3 className="overview-subtitle">{t('overview.untouchedTitle', untouched.length)}</h3>
      <ul className="overview-list">
        {untouched.map((row) => <li key={row.quiz_id}>
          <button type="button" className="overview-item overview-item-untouched" onClick={() => onSelectQuiz(row.quiz_id)}>
            <span className="overview-item-head">
              <span className="overview-item-title">{row.quiz_title}</span>
              <span className="overview-item-percent">{t('overview.questionCount', row.question_count)}</span>
            </span>
          </button>
        </li>)}
      </ul>
    </>}
  </section>
}
