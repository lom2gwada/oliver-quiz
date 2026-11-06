import { useEffect, useState } from 'react'
import { useTranslation } from '../i18n'
import { CoverageBar } from './CoverageBar'
import { QuizCover } from './QuizCover'
import { coverageImage, coveragePercentTenths, coverageTotals, fetchQuizCoverage, filterCoverage, REVIEW_BATCH_SIZE, splitCoverage, type QuizCoverage } from '../utils/coverage'
import { longDate } from '../utils/dateFormat'
import { formatPercent } from '../utils/format'
import { normalizeQuizLanguage, quizLanguageLabel } from '../utils/quizLanguage'

interface OverviewPageProps {
  /** Quiz actuellement sélectionné : signalé par un badge « Actif ». */
  activeQuizId: string
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

export function OverviewPage({ activeQuizId, onSelectQuiz, onReviewQuiz, onViewHistory, onViewLeaderboard, onBack }: OverviewPageProps) {
  const { t, language } = useTranslation()
  const [rows, setRows] = useState<QuizCoverage[] | null>(null)
  const [error, setError] = useState(false)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewError, setReviewError] = useState(false)
  const [search, setSearch] = useState('')

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

  const all = splitCoverage(rows ?? [])
  const totals = coverageTotals(all.started)
  // La recherche ne filtre que l'affichage : le résumé du haut reste celui de tous les quiz commencés.
  const searching = search.trim() !== ''
  const started = filterCoverage(all.started, search)
  const untouched = filterCoverage(all.untouched, search)

  return <section className="stats-page">
    <div className="stats-header">
      <h2>{t('overview.title')}</h2>
      <button type="button" className="secondary" onClick={onBack}>{t('common.back')}</button>
    </div>
    {error && <p className="alert" role="alert">{t('overview.errorLoad')} <button type="button" className="secondary alert-retry" onClick={load}>{t('start.retry')}</button></p>}
    {reviewError && <p className="alert" role="alert">{t('overview.errorReview')}</p>}
    {!rows && !error && <p>{t('common.loading')}</p>}
    {rows && !all.started.length && <p>{t('overview.emptyState')}</p>}
    {rows && rows.length > 0 && <label className="question-search">{t('overview.searchLabel')}
      <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('overview.searchPlaceholder')} />
    </label>}
    {searching && rows && <p className="mode-hint question-search-count" role="status">{started.length + untouched.length ? t('overview.searchResults', started.length + untouched.length, rows.length) : t('overview.searchNone')}</p>}
    {all.started.length > 0 && <>
      <div className="overview-summary">
        <strong>{t('overview.summary', all.started.length, totals.seen, totals.total)}</strong>
        <CoverageBar percent={totals.percent} label={t('overview.summaryBarLabel')} />
      </div>
      {started.length > 0 && <ul className="overview-list">
        {started.map((row) => {
          const percent = coveragePercentTenths(row.seen_count, row.question_count)
          const batch = Math.min(row.due_count, REVIEW_BATCH_SIZE)
          return <li key={row.quiz_id} className={row.quiz_id === activeQuizId ? 'overview-card overview-card-active' : 'overview-card'}>
            <button type="button" className="overview-item" onClick={() => onSelectQuiz(row.quiz_id)}>
              <span className="overview-item-head">
                <span className="overview-item-id"><QuizCover image={coverageImage(row)} /><span className="overview-item-title">{row.quiz_title}{row.quiz_id === activeQuizId && <span className="overview-badge">{t('overview.activeBadge')}</span>}</span></span>
                <span className="overview-item-percent" title={t('metric.discoveredHint')}>{formatPercent(percent, language, 1)} <small className="overview-item-percent-label">{t('metric.discoveredShort')}</small></span>
              </span>
              <CoverageBar percent={percent} label={`${row.quiz_title} — ${t('metric.discovered', formatPercent(percent, language, 1))}`} />
              <span className="overview-item-meta">
                {t('overview.seen', row.seen_count, row.question_count)} · {t('overview.games', row.games_played)}
                {row.last_played_at && <> · {t('overview.lastPlayed', longDate(row.last_played_at, language))}</>}
              </span>
              <span className="overview-item-action">{t('overview.choose')} ›</span>
            </button>
            <div className="overview-review">
              {batch > 0 && <button type="button" className="secondary" disabled={reviewingId !== null} onClick={() => review(row.quiz_id)}>{reviewingId === row.quiz_id ? t('common.loading') : t('overview.review', batch)}</button>}
              <button type="button" className="secondary" disabled={reviewingId !== null} onClick={() => onViewHistory(row.quiz_id)}>{t('overview.history')}</button>
              <button type="button" className="secondary" disabled={reviewingId !== null} onClick={() => onViewLeaderboard(row.quiz_id)}>{t('overview.leaderboard')}</button>
              <span className="overview-item-meta">{batch > 0 ? t('overview.dueNote', row.due_count) : t('overview.nothingDue')}</span>
            </div>
          </li>
        })}
      </ul>}
    </>}
    {rows && (all.started.length > 0 || all.untouched.length > 0) && <>
      {(untouched.length > 0 || !searching) && <h3 className="overview-subtitle">{t('overview.discoverTitle', untouched.length)}</h3>}
      {all.untouched.length === 0 && <p className="mode-hint">{t('overview.discoverEmpty')}</p>}
      <ul className="overview-list">
        {untouched.map((row) => <li key={row.quiz_id} className={row.quiz_id === activeQuizId ? 'overview-card overview-card-active' : 'overview-card'}>
          <button type="button" className="overview-item overview-item-untouched" onClick={() => onSelectQuiz(row.quiz_id)}>
            <span className="overview-item-head">
              <span className="overview-item-id"><QuizCover image={coverageImage(row)} /><span className="overview-item-title">{row.quiz_title}{row.quiz_id === activeQuizId && <span className="overview-badge">{t('overview.activeBadge')}</span>}</span></span>
              <span className="overview-item-percent">{t('overview.questionCount', row.question_count)}</span>
            </span>
            {row.description && <span className="overview-item-description">{row.description}</span>}
            {row.language && <span className="overview-item-meta">{quizLanguageLabel(normalizeQuizLanguage(row.language), language, t)}</span>}
            <span className="overview-item-action">{t('overview.choose')} ›</span>
          </button>
        </li>)}
      </ul>
    </>}
  </section>
}
