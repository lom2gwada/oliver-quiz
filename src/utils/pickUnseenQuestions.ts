import { pickFreshQuestions } from './pickFreshQuestions'
import { shuffle } from './shuffle'

/** Les questions du `pool` que `seen` ne contient pas encore. */
export const unseenQuestions = <T extends { id: string }>(pool: T[], seen: ReadonlySet<string>): T[] => pool.filter((question) => !seen.has(question.id))

/** Ordre de jeu des modes sans-faute et contre-la-montre, qui n'ont pas de nombre de questions fixé : le pool reste le même
 * (une série ne se gagne qu'en le finissant, les classements restent comparables), seul l'ordre change. Les questions jamais
 * vues (`seen`) passent en premier, mélangées ; les déjà vues ne viennent qu'ensuite, mélangées aussi. Sans `seen`, tout est
 * simplement mélangé, comme d'habitude. */
export function orderUnseenFirst<T extends { id: string }>(pool: T[], seen: ReadonlySet<string> | null | undefined): T[] {
  if (!seen) return shuffle(pool)
  return [...shuffle(unseenQuestions(pool, seen)), ...shuffle(pool.filter((question) => seen.has(question.id)))]
}

/** Tire `count` questions du `pool` en commençant par celles que le joueur n'a jamais rencontrées (`seen`). Quand il n'y
 * en a pas assez, les places restantes sont tirées parmi les questions déjà vues selon le tirage habituel
 * (`pickFreshQuestions` : au hasard, en évitant celles de la partie `previous` quand on en rejoue une). L'ordre final est mélangé. */
export function pickUnseenQuestions<T extends { id: string }>(pool: T[], seen: ReadonlySet<string>, count: number, previous: T[] = []): T[] {
  const target = Math.min(count, pool.length)
  const fresh = shuffle(unseenQuestions(pool, seen)).slice(0, target)
  if (fresh.length >= target) return fresh
  const alreadySeen = pool.filter((question) => seen.has(question.id))
  return shuffle([...fresh, ...pickFreshQuestions(alreadySeen, previous, target - fresh.length)])
}
