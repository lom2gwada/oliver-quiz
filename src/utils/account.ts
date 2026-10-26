import { supabase } from './supabase'

/** Le mot de passe donné est-il bien celui du compte ? Rejoue une connexion : c'est la réauthentification que Supabase
 * ne demande pas lui-même pour changer de mot de passe ou supprimer un compte. */
export async function verifyPassword(email: string, password: string): Promise<boolean> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return !error
}

export type DeleteAccountFailure = 'lastAdmin' | 'failed'

/** Pourquoi `delete_my_account()` a refusé : le dernier administrateur ne peut pas partir (voir 036_delete_my_account.sql). */
export function classifyDeleteError(message: string | undefined): DeleteAccountFailure {
  return message?.includes('last_admin') ? 'lastAdmin' : 'failed'
}

/** Supprime le compte connecté et ses données. `null` en cas de succès ; la session n'est plus valable ensuite. */
export async function deleteMyAccount(): Promise<DeleteAccountFailure | null> {
  const { error } = await supabase.rpc('delete_my_account')
  return error ? classifyDeleteError(error.message) : null
}
