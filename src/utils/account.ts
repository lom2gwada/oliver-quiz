import { soleOwnerTitles } from './adminUserActions'
import { supabase } from './supabase'

/** Le mot de passe donné est-il bien celui du compte ? Rejoue une connexion : c'est la réauthentification que Supabase
 * ne demande pas lui-même pour changer de mot de passe ou supprimer un compte. */
export async function verifyPassword(email: string, password: string): Promise<boolean> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return !error
}

export type DeleteAccountFailure = 'lastAdmin' | 'soleQuizOwner' | 'failed'

/** Pourquoi `delete_my_account()` a refusé : le dernier administrateur ne peut pas partir (036), ni le seul propriétaire d'un quiz (051). */
export function classifyDeleteError(message: string | undefined): DeleteAccountFailure {
  if (message?.includes('last_admin')) return 'lastAdmin'
  return message?.includes('sole_quiz_owner') ? 'soleQuizOwner' : 'failed'
}

/** Un refus de suppression, avec les titres des quiz dont le compte est le seul propriétaire (pour `soleQuizOwner`). */
export interface DeleteAccountRefusal { failure: DeleteAccountFailure; titles: string[] }

/** Supprime le compte connecté et ses données. `null` en cas de succès ; la session n'est plus valable ensuite. */
export async function deleteMyAccount(): Promise<DeleteAccountRefusal | null> {
  const { error } = await supabase.rpc('delete_my_account')
  if (!error) return null
  const failure = classifyDeleteError(error.message)
  return { failure, titles: failure === 'soleQuizOwner' ? soleOwnerTitles(error.details) : [] }
}
