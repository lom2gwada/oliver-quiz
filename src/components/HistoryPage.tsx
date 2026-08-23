import { useEffect, useState } from 'react'
import type { QuizResultRow } from '../types/history'
import { fetchQuizHistory } from '../utils/quizHistory'
import { formatDuration } from '../utils/time'

export function HistoryPage({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<QuizResultRow[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchQuizHistory().then(setRows).catch(() => setError("Impossible de charger l'historique."))
  }, [])

  return <section className="stats-page">
    <div className="stats-header">
      <h2>Historique des parties</h2>
      <button type="button" className="secondary" onClick={onBack}>Retour</button>
    </div>
    {error && <p className="alert" role="alert">{error}</p>}
    {!error && !rows && <p>Chargement…</p>}
    {rows && !rows.length && <p>Aucune partie enregistrée pour l'instant.</p>}
    {rows && rows.length > 0 && <ul className="history-list">
      {rows.map((row) => <li className="history-item" key={row.id}>
        <span className="history-score">{row.score}%</span>
        <span className="history-date">{new Date(row.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        <span className="history-themes">{row.themes.join(', ')}</span>
        <span>{row.earned_points} / {row.total_points} pts</span>
        <span>⏱ {formatDuration(row.elapsed_seconds)}</span>
      </li>)}
    </ul>}
  </section>
}
