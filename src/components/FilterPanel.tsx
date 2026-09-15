import type { Difficulty, Theme } from '../types/quiz'
import { useTranslation } from '../i18n'
import { playClick } from '../utils/sound'

interface FilterPanelProps {
  themes: Theme[]
  selectedThemes: string[]
  difficulty: Difficulty | ''
  onThemeToggle: (themeId: string) => void
  onDifficultyChange: (value: Difficulty | '') => void
}

export function FilterPanel({ themes, selectedThemes, difficulty, onThemeToggle, onDifficultyChange }: FilterPanelProps) {
  const { t } = useTranslation()
  return <section className="filter-panel" aria-label={t('filter.ariaLabel')}>
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
}
