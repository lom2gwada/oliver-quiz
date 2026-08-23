import { useEffect, useState } from 'react'
import type { QuizResultRow } from '../types/history'
import { computeRecords, fetchQuizHistory } from '../utils/quizHistory'
import { formatDuration } from '../utils/time'
import { ScoreChart } from './ScoreChart'

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
const longDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

export function HistoryPage({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<QuizResultRow[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchQuizHistory().then(setRows).catch(() => setError("Impossible de charger l'historique."))
  }, [])

  const records = rows ? computeRecords(rows) : null
  const chartPoints = rows ? [...rows].reverse().map((row) => ({ label: shortDate(row.created_at), score: row.score })) : []

  return <section className="stats-page">
    <div className="stats-header">
      <h2>Historique des parties</h2>
      <button type="button" className="secondary" onClick={onBack}>Retour</button>
    </div>
    {error && <p className="alert" role="alert">{error}</p>}
    {!error && !rows && <p>Chargement…</p>}
    {rows && !rows.length && <p>Aucune partie enregistrée pour l'instant.</p>}
    {records && records.gamesPlayed > 0 && <>
      <div className="records-grid">
        <div className="record-tile"><span className="record-value">{records.gamesPlayed}</span><span className="record-label">Parties jouées</span></div>
        <div className="record-tile"><span className="record-value">{records.bestScore}%</span><span className="record-label">Meilleur score</span></div>
        <div className="record-tile"><span className="record-value">{records.averageScore}%</span><span className="record-label">Score moyen</span></div>
        <div className="record-tile"><span className="record-value">{formatDuration(records.totalPlaytimeSeconds)}</span><span className="record-label">Temps de jeu cumulé</span></div>
      </div>
      <ScoreChart points={chartPoints} />
    </>}
    {rows && rows.length > 0 && <ul className="history-list">
      {rows.map((row) => <li className="history-item" key={row.id}>
        <span className="history-score">{row.score}%</span>
        <span className="history-date">{longDate(row.created_at)}</span>
        <span className="history-themes">{row.themes.join(', ')}</span>
        <span>{row.earned_points} / {row.total_points} pts</span>
        <span>⏱ {formatDuration(row.elapsed_seconds)}</span>
      </li>)}
    </ul>}
  </section>
}
