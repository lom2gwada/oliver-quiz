/** Confirmation par une boîte de dialogue de l'appli (voir `ConfirmHost`), à la place de `window.confirm` : même usage
 * (`if (await confirmDialog(...)) …`), mais aux couleurs de l'appli, traduite, avec des boutons explicites et un bouton
 * destructif en rouge. */
export interface ConfirmOptions {
  message: string
  /** Libellé explicite de l'action (« Abandonner la partie », « Supprimer la question »), pas « OK ». */
  confirmLabel: string
  /** « Annuler » par défaut. */
  cancelLabel?: string
  /** Titre de la boîte ; « Confirmation » par défaut. */
  title?: string
  /** Action destructive : bouton de confirmation en rouge, et focus d'abord sur « Annuler ». */
  destructive?: boolean
  /** Floute la page derrière la boîte (réservé à la page d'une question d'un quiz en cours). */
  blur?: boolean
}

/** Classe posée sur `#root` pendant qu'une confirmation à flou est ouverte : le flou lui-même est défini dans `styles.css`. */
export const CONFIRMING_CLASS = 'is-confirming'

interface Pending {
  options: ConfirmOptions
  resolve: (answer: boolean) => void
}

let current: Pending | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())

/** Pour `useSyncExternalStore` : la confirmation en attente (la même référence tant qu'elle n'a pas changé). */
export const subscribeConfirm = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
export const getPendingConfirm = (): Pending | null => current

/** Demande confirmation. Une boîte déjà ouverte fait refuser la suivante sans rien afficher : un double clic sur
 * « Annuler » n'en ouvre pas deux l'une après l'autre. */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  if (current) return Promise.resolve(false)
  return new Promise<boolean>((resolve) => { current = { options, resolve }; emit() })
}

/** Ferme la boîte avec la réponse donnée (Échap, clic à côté ou bouton « Annuler » : `false`). Sans effet si rien n'attend. */
export function settleConfirm(answer: boolean): void {
  const pending = current
  if (!pending) return
  current = null
  emit()
  pending.resolve(answer)
}
