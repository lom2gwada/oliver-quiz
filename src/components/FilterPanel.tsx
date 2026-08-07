import type { Difficulty, Theme } from '../types/quiz'

interface FilterPanelProps {
  themes: Theme[]
  theme: string
  difficulty: Difficulty | ''
  onThemeChange: (value: string) => void
  onDifficultyChange: (value: Difficulty | '') => void
}

export function FilterPanel({ themes, theme, difficulty, onThemeChange, onDifficultyChange }: FilterPanelProps) {
  return <section className="filter-panel" aria-label="Filtres du quiz">
    <label>Thème
      <select value={theme} onChange={(event) => onThemeChange(event.target.value)}>
        <option value="">Tous les thèmes</option>
        {themes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </label>
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
