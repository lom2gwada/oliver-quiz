import { useEffect, useState } from 'react'
import type { GuestLink, GuestResultRow } from '../types/guestLink'
import type { Quiz } from '../types/quiz'
import { useTranslation } from '../i18n'
import { fetchGuestResults } from '../utils/guestLinks'
import { computeQuestionCorrectness, summarizeGuestResults, tallyAnswers } from '../utils/guestResults'
import { formatDuration } from '../utils/time'

const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)

function Bar({ value }: { value: number }) {
  return <div className="quiz-progress"><div className="quiz-progress-fill" style={{ width: `${value}%` }} /></div>
}

/** Admin uniquement : réponses reçues via un lien invité, agrégées — nombre de répondants, score moyen (mode test),
 * détail par question (taux de réussite en test, répartition des choix en sondage) et liste des répondants.
 * Les questions viennent du quiz actuellement chargé : celles supprimées depuis n'apparaissent plus dans le détail. */
export function GuestResultsPanel({ link, quiz }: { link: GuestLink; quiz: Quiz }) {
  const { t, language } = useTranslation()
  const [results, setResults] = useState<GuestResultRow[] | null>(null)
  const [error, setError] = useState(false)
  const isTest = link.mode === 'test'

  useEffect(() => {
    fetchGuestResults(link.token).then(setResults).catch(() => setError(true))
  }, [link.token])

  if (error) return <p className="alert" role="alert">{t('admin.guestResultsErrorLoad')}</p>
  if (!results) return <p>{t('common.loading')}</p>
  if (!results.length) return <p>{t('admin.guestResultsEmpty')}</p>

  const summary = summarizeGuestResults(results)
  const dateLabel = (iso: string) => new Date(iso).toLocaleString(language === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  return <div className="guest-results">
    <div className="records-grid">
      <div className="record-tile"><span className="record-value">{summary.count}</span><span className="record-label">{t('admin.guestResultsCount')}</span></div>
      {isTest && summary.averageScore !== null && <div className="record-tile"><span className="record-value">{summary.averageScore}%</span><span className="record-label">{t('admin.guestResultsAverageScore')}</span></div>}
      <div className="record-tile"><span className="record-value">{formatDuration(summary.averageSeconds)}</span><span className="record-label">{t('admin.guestResultsAverageTime')}</span></div>
    </div>
    <details className="question-list-group">
      <summary>{t('admin.guestResultsPerQuestion')}</summary>
      <div className="guest-results-questions">
        {isTest
          ? computeQuestionCorrectness(results, quiz.questions).map(({ question, correct, total }) => <article key={question.id} className="guest-results-question">
            <p className="question-list-prompt">{question.question}</p>
            <Bar value={percent(correct, total)} />
            <p className="mode-hint">{t('admin.guestResultsCorrectRate', correct, total, percent(correct, total))}</p>
          </article>)
          : quiz.questions.map((question) => <article key={question.id} className="guest-results-question">
            <p className="question-list-prompt">{question.question}</p>
            {tallyAnswers(question, results, t).map((tally) => <div key={tally.label} className="guest-results-tally">
              <span className="guest-results-tally-label">{tally.label}</span>
              <Bar value={percent(tally.count, results.length)} />
              <span className="guest-results-tally-count">{tally.count}</span>
            </div>)}
          </article>)}
      </div>
    </details>
    <h4>{t('admin.guestResultsReceived')}</h4>
    <ul className="history-list">
      {results.map((result) => <li className="history-item" key={result.id}>
        <span className="history-score">{result.score !== null ? `${result.score}%` : '—'}</span>
        <span>{result.respondent_name}</span>
        <span className="history-date">{dateLabel(result.created_at)}</span>
        <span>{t('common.durationIcon', formatDuration(result.elapsed_seconds))}</span>
      </li>)}
    </ul>
  </div>
}
