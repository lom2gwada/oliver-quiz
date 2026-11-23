import { UserActionError, type UserActionFailure } from './adminUserActions'
import type { AdminUser } from './adminUsers'

export type BulkAction = 'disable' | 'enable' | 'grant' | 'revoke'

export interface BulkPlan {
  /** Ceux auxquels l'action s'applique réellement. */
  targets: AdminUser[]
  /** Ceux qu'on laisse de côté d'avance, avec la raison : c'est leur propre compte, ou ils sont déjà dans l'état voulu. */
  skipped: { user: AdminUser; reason: 'self' | 'already' }[]
}

/** Qui est concerné par une action en lot. Désactiver ignore son propre compte (les garde-fous de la base le refuseraient de toute façon,
 * autant ne pas le promettre dans la confirmation) et les comptes déjà désactivés ; réactiver ignore les comptes déjà actifs. Accorder ou
 * retirer un accès concerne tout le monde : la liste ne dit pas qui a déjà accès à tel quiz, et la base ne journalise que les changements. */
export function planBulk(action: BulkAction, users: AdminUser[]): BulkPlan {
  const plan: BulkPlan = { targets: [], skipped: [] }
  for (const user of users) {
    if (action === 'disable' && user.is_self) plan.skipped.push({ user, reason: 'self' })
    else if (action === 'disable' && user.disabled) plan.skipped.push({ user, reason: 'already' })
    else if (action === 'enable' && !user.disabled) plan.skipped.push({ user, reason: 'already' })
    else plan.targets.push(user)
  }
  return plan
}

export interface BulkResult {
  done: AdminUser[]
  failed: { user: AdminUser; failure: UserActionFailure }[]
}

/** Applique `task` à chaque utilisateur, UN À LA FOIS et dans l'ordre : chaque appel est une action à part entière, avec ses garde-fous et sa
 * ligne de journal. Séquentiel exprès : désactiver deux administrateurs d'un coup doit voir le premier avant de juger le second (« dernier
 * administrateur actif »). Un refus n'arrête pas les autres ; il est rapporté avec sa raison. Ce n'est pas atomique, et c'est voulu : ce qui a
 * réussi reste fait et journalisé. */
export async function runBulk(targets: AdminUser[], task: (user: AdminUser) => Promise<unknown>): Promise<BulkResult> {
  const result: BulkResult = { done: [], failed: [] }
  for (const user of targets) {
    try {
      await task(user)
      result.done.push(user)
    } catch (error) {
      result.failed.push({ user, failure: error instanceof UserActionError ? error.failure : 'failed' })
    }
  }
  return result
}

/** Les premiers pseudos pour une confirmation, et combien d'autres on ne nomme pas. */
export function namesPreview(users: AdminUser[], max = 6): { names: string; more: number } {
  return { names: users.slice(0, max).map((user) => user.pseudo).join(', '), more: Math.max(0, users.length - max) }
}
