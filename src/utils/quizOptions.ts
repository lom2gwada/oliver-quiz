import type { Language } from '../i18n/types'

export interface QuizOption {
  key: string
  label: string
}

const LOCALES: Record<Language, string> = { fr: 'fr-FR', en: 'en-GB' }

/** Liste du sélecteur de quiz, commune à l'historique et au classement : les quiz auxquels le joueur a accès, plus ceux
 * dont une ligne de données existe encore (quiz supprimé depuis, repérés par leur titre figé), plus le quiz actif —
 * triés par nom. Avant, chaque page ne listait que les quiz ayant des lignes *chez elle* (9 quiz d'un côté, 13 de
 * l'autre, dans deux ordres différents).
 *
 * Un quiz se repère par son `id` quand il est connu, sinon par son titre. Pour le nom affiché, le titre courant d'un
 * quiz accessible prime sur le titre figé dans les anciennes lignes, et celui du quiz actif sur tout le reste. */
export function buildQuizOptions({ hosted, seen, active, language }: {
  hosted: { id: string; title: string }[]
  /** Les quiz repérés dans les lignes de la page ; le premier nom rencontré pour une clé est retenu. */
  seen: QuizOption[]
  active: QuizOption
  language: Language
}): QuizOption[] {
  const labels = new Map<string, string>()
  seen.forEach(({ key, label }) => { if (!labels.has(key)) labels.set(key, label) })
  hosted.forEach(({ id, title }) => labels.set(id, title))
  labels.set(active.key, active.label)
  const collator = new Intl.Collator(LOCALES[language], { sensitivity: 'base' })
  return Array.from(labels, ([key, label]) => ({ key, label })).sort((a, b) => collator.compare(a.label, b.label))
}
