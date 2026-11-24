import type { HostedQuizSummary } from '../types/hostedQuiz'
import type { QuizRole } from './quizAdmins'

/** Le rôle du compte connecté sur chaque quiz qu'il administre, par id de quiz (`fetchMyQuizRoles`). */
export type QuizRoles = Record<string, QuizRole>

/** Ce que le compte connecté peut faire sur un quiz. Ce n'est qu'un reflet pour l'interface (masquer ce qui serait refusé) :
 * les droits eux-mêmes sont contrôlés en base (`051_quiz_admins.sql`). */
export interface QuizPermissions {
  /** Le contenu, les accès, les liens invités et leurs résultats, l'import et l'export : tout administrateur du quiz. */
  manage: boolean
  /** Rendre le quiz public, gérer la liste des administrateurs, supprimer le quiz : les propriétaires. */
  owner: boolean
  /** D'où viennent ces droits : l'administrateur global, ou le rôle sur ce quiz. `null` : aucun droit. */
  level: 'global' | QuizRole | null
}

export function quizPermissions(quizId: string, isGlobalAdmin: boolean, roles: QuizRoles): QuizPermissions {
  if (isGlobalAdmin) return { manage: true, owner: true, level: 'global' }
  const role = quizId ? roles[quizId] : undefined
  if (role === 'owner') return { manage: true, owner: true, level: 'owner' }
  if (role === 'admin') return { manage: true, owner: false, level: 'admin' }
  return { manage: false, owner: false, level: null }
}

/** Le compte peut-il ouvrir la page « Quiz » ? Administrateur global, ou administrateur d'au moins un quiz. */
export const administersAnyQuiz = (isGlobalAdmin: boolean, roles: QuizRoles): boolean => isGlobalAdmin || Object.keys(roles).length > 0

/** Les quiz à lister dans la page « Quiz » : tous pour l'administrateur global, ceux qu'on administre pour les autres. */
export function administeredQuizzes(quizzes: HostedQuizSummary[], isGlobalAdmin: boolean, roles: QuizRoles): HostedQuizSummary[] {
  return isGlobalAdmin ? quizzes : quizzes.filter((quiz) => roles[quiz.id] !== undefined)
}
