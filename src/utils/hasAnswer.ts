import type { UserAnswer } from '../types/quiz'

/** Une réponse a-t-elle été donnée ? Texte non vide, ou au moins un identifiant choisi. Sert à ne pas laisser passer une
 * question de révision par un simple clic sur « Suivante ». */
export function hasAnswer(answer: UserAnswer | undefined): boolean {
  if (answer === undefined) return false
  return typeof answer === 'string' ? answer.trim() !== '' : answer.length > 0
}
