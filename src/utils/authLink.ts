/** Le fragment d'URL (#...) que Supabase ajoute après un clic sur un lien d'invitation/récupération. */
export function needsPasswordSetup(hash: string): boolean {
  return /type=(invite|recovery)/.test(hash)
}

/** Supabase redirige avec `#error=...` (au lieu d'un token) quand le lien est invalide, expiré ou déjà utilisé. */
export function hasAuthLinkError(hash: string): boolean {
  return /error=/.test(hash)
}
