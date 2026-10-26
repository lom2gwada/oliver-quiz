/** Barre de progression « questions vues » (« Mes quiz » et accueil) ; verte quand tout le quiz a été vu. */
export function CoverageBar({ percent, label }: { percent: number; label: string }) {
  return <div className="quiz-progress overview-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={label}>
    <div className={percent === 100 ? 'quiz-progress-fill overview-bar-complete' : 'quiz-progress-fill'} style={{ width: `${percent}%` }} />
  </div>
}
