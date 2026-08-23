interface ScorePoint {
  label: string
  score: number
}

export function ScoreChart({ points }: { points: ScorePoint[] }) {
  if (points.length < 2) return null

  const width = 100
  const height = 36
  const stepX = width / (points.length - 1)
  const coords = points.map((point, index) => `${index * stepX},${height - (point.score / 100) * height}`)
  const linePoints = coords.join(' ')
  const areaPoints = `0,${height} ${linePoints} ${width},${height}`

  return <figure className="score-chart">
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Évolution du score dans le temps">
      <polyline className="score-chart-baseline" points={`0,${height} ${width},${height}`} />
      <polygon className="score-chart-area" points={areaPoints} />
      <polyline className="score-chart-line" points={linePoints} />
    </svg>
    <div className="score-chart-labels"><span>{points[0].label}</span><span>{points[points.length - 1].label}</span></div>
  </figure>
}
