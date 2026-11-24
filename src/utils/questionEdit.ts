import { useCallback, useState } from 'react'
import type { Question } from '../types/quiz'

const sameSet = (first: readonly { id: string }[], second: readonly { id: string }[]): boolean =>
  first.length === second.length && first.every((item) => second.some((other) => other.id === item.id))

/** Une réponse déjà saisie a-t-elle encore un sens après la modification de la question ? Oui tant que ce qu'elle désigne existe
 * toujours : l'énoncé, la difficulté, les points, le thème, l'explication ou le libellé d'une réponse peuvent changer sans la
 * perdre. Non si le type change, ou si les réponses proposées (leurs identifiants) ne sont plus les mêmes : la réponse saisie
 * pointerait vers des choix qui n'existent plus, ou en oublierait de nouveaux.
 * Les réponses libres (texte, texte à trous, nombre) et vrai ou faux n'ont pas de choix proposés : elles restent valables. */
export function answerSurvivesEdit(before: Question, after: Question): boolean {
  if (before.type !== after.type) return false
  switch (after.type) {
    case 'qcm': return sameSet((before as typeof after).content.answers, after.content.answers)
    case 'code': return sameSet((before as typeof after).content.answers, after.content.answers)
    case 'ordering': return sameSet((before as typeof after).content.items, after.content.items)
    case 'matching': {
      const previous = (before as typeof after).content
      return sameSet(previous.left, after.content.left) && sameSet(previous.right, after.content.right)
    }
    default: return true
  }
}

/** La liste donnée avec, à la place de chaque question de même identifiant, la version modifiée (`prepare` la met en forme, par
 * exemple en mélangeant ses réponses comme au lancement de la partie). Les autres questions gardent leur place et leur ordre. */
export function replaceQuestion(list: readonly Question[], updated: Question, prepare: (question: Question) => Question = (question) => question): Question[] {
  return list.map((question) => (question.id === updated.id ? prepare(updated) : question))
}

const NO_EDITS: Record<string, Question> = {}

/** Les questions modifiées en cours de partie, par identifiant, pour une liste de questions de départ (`source`). Quand `source`
 * change (une autre partie), les modifications de la précédente sont oubliées. `overlay` remplace dans une liste chaque question
 * modifiée par sa nouvelle version. */
export function useQuestionEdits(source: unknown) {
  const [state, setState] = useState<{ source: unknown; byId: Record<string, Question> }>({ source, byId: NO_EDITS })
  const byId = state.source === source ? state.byId : NO_EDITS
  const record = useCallback((question: Question) => setState((previous) => ({ source, byId: { ...(previous.source === source ? previous.byId : NO_EDITS), [question.id]: question } })), [source])
  const overlay = useCallback((list: Question[]) => list.map((question) => byId[question.id] ?? question), [byId])
  return { record, overlay }
}
