import type { Profile } from '../types/profile'

/** Le pseudo saisi diffère-t-il de celui enregistré ? C'est la seule modification que le profil garde « en brouillon » :
 * le thème et l'avatar s'enregistrent dès qu'on les choisit. Sans profil chargé, tout pseudo saisi est à enregistrer. */
export function isPseudoDirty(saved: Pick<Profile, 'pseudo'> | null, draft: string): boolean {
  return draft.trim() !== (saved?.pseudo ?? '')
}
