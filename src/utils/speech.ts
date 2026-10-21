import type { Question } from '../types/quiz'

/** Mot lu à la place d'un trou (`___`) dans un texte à trous, dans la langue de lecture ; une courte pause sinon
 * (langue sans équivalent connu), plutôt qu'un mot de la mauvaise langue. */
function blankWord(languageTag: string): string {
  const base = languageTag.toLowerCase().split('-')[0]
  if (base === 'fr') return 'blanc'
  if (base === 'en') return 'blank'
  return ','
}

/** Ce qui est lu pour une question : son énoncé seulement — ni les réponses (inutile et trop long), ni le code,
 * les tableaux ou diagrammes, qui se lisent très mal. Les trous d'un texte à trous deviennent « blanc »/« blank »
 * et les apostrophes inversées du code en ligne sont retirées pour ne pas être épelées. */
export function questionToSpeech(question: Question, languageTag: string): string {
  return question.question
    .replace(/_{3,}/g, ` ${blankWord(languageTag)} `)
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
