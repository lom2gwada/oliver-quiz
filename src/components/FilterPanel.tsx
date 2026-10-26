import { useState } from 'react'
import type { Difficulty, Category } from '../types/quiz'
import { useTranslation } from '../i18n'
import { playClick } from '@engine/utils/sound'

interface FilterPanelProps {
  themes: Category[]
  selectedThemes: string[]
  difficulty: Difficulty | ''
  onThemeToggle: (themeId: string) => void
  onDifficultyChange: (value: Difficulty | '') => void
}

/** Sur téléphone, les filtres sont repliés par défaut : la liste des thèmes rallonge beaucoup l'accueil (quiz à
 * plusieurs dizaines de thèmes) alors que la plupart des parties se lancent sans filtre. Le résumé indique combien de
 * filtres sont actifs ; sur grand écran le panneau reste ouvert et le résumé masqué (voir `styles.css`). */
const startsCollapsed = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 550px)').matches

export function FilterPanel({ themes, selectedThemes, difficulty, onThemeToggle, onDifficultyChange }: FilterPanelProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(() => !startsCollapsed())
  const activeFilters = selectedThemes.length + (difficulty ? 1 : 0)
  return <details className="filter-details" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary className="filter-summary">{t('filter.summary', activeFilters)}</summary>
    <section className="filter-panel" aria-label={t('filter.ariaLabel')}>
      <fieldset className="theme-filter">
        <legend>{t('filter.themesLegend')}</legend>
        <div className="theme-checkboxes">
          {themes.map((item) => <label key={item.id} className="theme-checkbox">
            <input type="checkbox" checked={selectedThemes.includes(item.id)} onChange={() => { playClick(); onThemeToggle(item.id) }} />
            {item.label}
          </label>)}
        </div>
        <p className="theme-hint">{t('filter.themesSelected', selectedThemes.length)}</p>
      </fieldset>
      <label>{t('filter.difficultyLabel')}
        <select value={difficulty} onChange={(event) => { playClick(); onDifficultyChange(event.target.value as Difficulty | '') }}>
          <option value="">{t('filter.allDifficulties')}</option>
          <option value="easy">{t('quiz.difficultyEasy')}</option>
          <option value="medium">{t('quiz.difficultyMedium')}</option>
          <option value="hard">{t('quiz.difficultyHard')}</option>
        </select>
      </label>
    </section>
  </details>
}
