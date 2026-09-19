import { shuffle } from './shuffle'

/** Tire `count` questions du `pool` en évitant celles déjà jouées (`previous`) : d'abord des questions jamais vues,
 * et seulement si le pool n'en compte pas assez, on complète avec des questions de la partie précédente. Ainsi une
 * nouvelle partie "avec les mêmes paramètres" n'est identique à la précédente que lorsque le pool ne permet pas mieux
 * (ex. "toutes les questions"). L'ordre final est mélangé. */
export function pickFreshQuestions<T extends { id: string }>(pool: T[], previous: T[], count: number): T[] {
  const played = new Set(previous.map((question) => question.id))
  const unseen = shuffle(pool.filter((question) => !played.has(question.id)))
  const target = Math.min(count, pool.length)
  const picked = unseen.slice(0, target)
  if (picked.length < target) picked.push(...shuffle(pool.filter((question) => played.has(question.id))).slice(0, target - picked.length))
  return shuffle(picked)
}
