/** Classe posée sur `#root` pendant qu'une confirmation est ouverte : le flou lui-même est défini dans `styles.css`. */
export const CONFIRMING_CLASS = 'is-confirming'

let pending = false

/** Comme `window.confirm`, mais la page est floutée tant que la boîte de dialogue est ouverte. Réservé à la page d'une
 * question d'un quiz en cours (abandon, retour arrière) : les autres confirmations de l'appli, comme les suppressions
 * de l'admin, restent des `window.confirm` ordinaires.
 *
 * La boîte native bloque le fil principal : le navigateur ne peut plus repeindre une fois qu'elle est affichée. Le
 * flou est donc posé d'abord, puis on attend deux images (le temps que le navigateur le peigne) avant d'ouvrir la
 * boîte. Une confirmation déjà en cours fait refuser la suivante sans rien afficher : un double clic sur
 * « Annuler » n'ouvre pas deux boîtes l'une après l'autre. */
export async function confirmWithBlur(message: string): Promise<boolean> {
  if (pending) return false
  pending = true
  const root = document.getElementById('root') ?? document.body
  root.classList.add(CONFIRMING_CLASS)
  try {
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    return window.confirm(message)
  } finally {
    root.classList.remove(CONFIRMING_CLASS)
    pending = false
  }
}
