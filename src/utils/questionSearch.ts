import type { Question } from '../types/quiz'

/** Minuscules et sans accents : « Eléphant » trouve « elephant ». */
export const normalizeSearch = (text: string): string => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Une question correspond-elle à la recherche (déjà normalisée) ? On cherche dans ce que la fiche montre : l'énoncé et
 * la ou les bonnes réponses. Une recherche vide les retient toutes. `answerOf` donne le texte de la bonne réponse. */
export function matchesQuestion(question: Question, normalizedQuery: string, answerOf: (question: Question) => string): boolean {
  if (!normalizedQuery) return true
  return normalizeSearch(question.question).includes(normalizedQuery) || normalizeSearch(answerOf(question)).includes(normalizedQuery)
}
