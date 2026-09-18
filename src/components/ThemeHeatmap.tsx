import type { ThemeWeekHeatmap } from '../types/history'
import { useTranslation } from '../i18n'

/** Du rouge (0 %) au vert (100 %) en passant par l'ambre — teinte HSL directe, lisible en thème clair comme sombre. */
const rateColor = (rate: number) => `hsl(${Math.round(rate * 1.2)} 62% 38%)`

export function ThemeHeatmap({ heatmap, title, note }: { heatmap: ThemeWeekHeatmap; title: string; note?: string }) {
  const { t, language } = useTranslation()
  const locale = language === 'en' ? 'en-GB' : 'fr-FR'
  const weekLabel = (key: string) => new Date(`${key}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' })

  return <figure className="theme-heatmap">
    <figcaption><h3 className="stats-group-title">{title}</h3></figcaption>
    <div className="theme-heatmap-scroll">
      <table>
        <thead>
          <tr>
            <th scope="col"><span className="sr-only">{t('history.heatmapThemeColumn')}</span></th>
            {heatmap.weeks.map((week) => <th scope="col" key={week}>{weekLabel(week)}</th>)}
          </tr>
        </thead>
        <tbody>
          {heatmap.themes.map((theme) => <tr key={theme.label}>
            <th scope="row">{theme.label}</th>
            {theme.cells.map((cell, index) => {
              if (!cell || !cell.total) return <td key={heatmap.weeks[index]} className="theme-heatmap-empty" aria-label={t('history.heatmapNoData')}>·</td>
              const rate = Math.round((cell.correct / cell.total) * 100)
              return <td key={heatmap.weeks[index]} style={{ background: rateColor(rate) }} title={t('history.heatmapCellTitle', cell.correct, cell.total)}>{rate}%</td>
            })}
          </tr>)}
        </tbody>
      </table>
    </div>
    <div className="theme-heatmap-legend" aria-hidden="true"><span>0 %</span><div className="theme-heatmap-legend-bar" /><span>100 %</span></div>
    {note && <p className="radar-chart-note">{note}</p>}
  </figure>
}
