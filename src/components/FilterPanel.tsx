import type { Difficulty, Theme } from '../types/quiz'

interface FilterPanelProps {
  themes: Theme[]
  selectedThemes: string[]
  difficulty: Difficulty | ''
  onThemeToggle: (themeId: string) => void
  onDifficultyChange: (value: Difficulty | '') => void
}

export function FilterPanel({ themes, selectedThemes, difficulty, onThemeToggle, onDifficultyChange }: FilterPanelProps) {
  return <section className="filter-panel" aria-label="Filtres du quiz">
    <fieldset className="theme-filter">
      <legend>Thèmes</legend>
      <div className="theme-checkboxes">
        {themes.map((item) => <label key={item.id} className="theme-checkbox">
          <input type="checkbox" checked={selectedThemes.includes(item.id)} onChange={() => onThemeToggle(item.id)} />
          {item.label}
        </label>)}
      </div>
      <p className="theme-hint">{selectedThemes.length ? `${selectedThemes.length} thème${selectedThemes.length > 1 ? 's' : ''} sélectionné${selectedThemes.length > 1 ? 's' : ''}` : 'Tous les thèmes'}</p>
    </fieldset>
    <label>Difficulté
      <select value={difficulty} onChange={(event) => onDifficultyChange(event.target.value as Difficulty | '')}>
        <option value="">Toutes les difficultés</option>
        <option value="easy">Facile</option>
        <option value="medium">Intermédiaire</option>
        <option value="hard">Difficile</option>
      </select>
    </label>
  </section>
}
