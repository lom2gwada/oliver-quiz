interface RadarAxisPoint {
  label: string
  value: number
}

const SIZE = 100
const CENTER = SIZE / 2
const RADIUS = 32
const RINGS = [0.25, 0.5, 0.75, 1]

function pointAt(angleDeg: number, radius: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180
  return [CENTER + radius * Math.cos(rad), CENTER + radius * Math.sin(rad)]
}

/** Vue d'ensemble du taux de réussite sur plusieurs axes comparables (thèmes) — un radar n'a de sens qu'à
 * partir de 3 axes (sinon on ne forme pas de polygone) et reste lisible jusqu'à une dizaine (cf. `bucketsToRadarAxes`
 * qui limite déjà en amont), donc pas de garde supplémentaire sur le nombre max ici. */
export function RadarChart({ title, axes, note }: { title: string; axes: RadarAxisPoint[]; note?: string }) {
  if (axes.length < 3) return null

  const angleStep = 360 / axes.length
  const angleFor = (index: number) => -90 + index * angleStep

  const dataPoints = axes.map((axis, index) => pointAt(angleFor(index), RADIUS * (axis.value / 100)))
  const dataPolygon = dataPoints.map(([x, y]) => `${x},${y}`).join(' ')

  return <figure className="radar-chart">
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={title}>
      {RINGS.map((ring) => <polygon key={ring} className="radar-chart-ring"
        points={axes.map((_, index) => pointAt(angleFor(index), RADIUS * ring).join(',')).join(' ')} />)}
      {axes.map((axis, index) => {
        const [x, y] = pointAt(angleFor(index), RADIUS)
        return <line key={axis.label} className="radar-chart-axis" x1={CENTER} y1={CENTER} x2={x} y2={y} />
      })}
      <polygon className="radar-chart-shape" points={dataPolygon} />
      {dataPoints.map(([x, y], index) => <circle key={axes[index].label} className="radar-chart-point" cx={x} cy={y} r="1.6" />)}
      {axes.map((axis, index) => {
        const angle = angleFor(index)
        const [x, y] = pointAt(angle, RADIUS + 9)
        const cos = Math.cos((angle * Math.PI) / 180)
        const anchor = Math.abs(cos) < 0.35 ? 'middle' : cos > 0 ? 'start' : 'end'
        return <text key={axis.label} className="radar-chart-label" x={x} y={y} textAnchor={anchor}>{axis.label}</text>
      })}
    </svg>
    <figcaption>
      <h3>{title}</h3>
      <ul>
        {axes.map((axis) => <li key={axis.label}>{axis.label} — {axis.value}%</li>)}
      </ul>
      {note && <p className="radar-chart-note">{note}</p>}
    </figcaption>
  </figure>
}
