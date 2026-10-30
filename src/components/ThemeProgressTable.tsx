import { useTranslation } from '../i18n'
import { formatPercent } from '../utils/format'
import type { ThemeProgressView } from '../utils/themeProgress'
import { CoverageBar } from './CoverageBar'

/** Une ligne par thème : questions découvertes, questions maîtrisées (deux barres) et taux de réussite. */
export function ThemeProgressTable({ themes }: { themes: ThemeProgressView[] }) {
  const { t, language } = useTranslation()
  const percent = (value: number) => formatPercent(value, language, 1)

  return <figure className="theme-progress">
    <figcaption>
      <h3 className="stats-group-title">{t('history.themeProgressTitle')}</h3>
      <p className="mode-hint">{t('history.themeProgressHint')}</p>
    </figcaption>
    <div className="theme-progress-scroll">
      <table>
        <thead>
          <tr>
            <th scope="col">{t('history.heatmapThemeColumn')}</th>
            <th scope="col">{t('history.themeSeenColumn')}</th>
            <th scope="col">{t('history.themeMasteredColumn')}</th>
            <th scope="col">{t('history.themeSuccessColumn')}</th>
          </tr>
        </thead>
        <tbody>
          {themes.map((theme) => <tr key={theme.theme_id}>
            <th scope="row">{theme.theme_label}</th>
            <td>
              <span className="theme-progress-count">{theme.seen_count} / {theme.question_count}</span>
              <CoverageBar percent={theme.seenPercent} label={`${theme.theme_label} — ${t('history.themeSeenColumn')} ${percent(theme.seenPercent)}`} />
            </td>
            <td>
              <span className="theme-progress-count">{theme.mastered_count} / {theme.question_count}</span>
              <CoverageBar percent={theme.masteredPercent} label={`${theme.theme_label} — ${t('history.themeMasteredColumn')} ${percent(theme.masteredPercent)}`} />
            </td>
            <td className="theme-progress-success" title={theme.successRate === null ? undefined : t('history.heatmapCellTitle', theme.correct_attempts, theme.attempts)}>
              {theme.successRate === null ? <span aria-label={t('history.themeNeverPlayed')}>·</span> : formatPercent(theme.successRate, language)}
            </td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </figure>
}
