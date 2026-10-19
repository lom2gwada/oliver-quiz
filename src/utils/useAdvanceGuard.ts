import { useEffect, useRef } from 'react'

/** Durée pendant laquelle une question qui vient de s'afficher ignore « Suivante » (bouton ou touche Entrée) : un
 * double clic, ou deux Entrées de suite, ne doit pas faire sauter une question qu'on n'a jamais vue — elle
 * apparaîtrait ensuite au corrigé sans réponse. Assez long pour absorber un double clic, trop court pour gêner
 * quelqu'un qui lit la question avant de répondre. */
export const MIN_QUESTION_DISPLAY_MS = 700

export const advanceAllowed = (shownAt: number, now: number, minimumMs = MIN_QUESTION_DISPLAY_MS): boolean => now - shownAt >= minimumMs

/** `questionKey` change à chaque nouvelle question affichée (même question rejouée comprise : y inclure l'indice).
 * Renvoie une fonction qui dit si un passage à la suivante déclenché par l'utilisateur est pris en compte. Le temps
 * limite d'une question, lui, n'en dépend pas : il avance toujours, quand il expire. */
export function useAdvanceGuard(questionKey: string): () => boolean {
  const shownAt = useRef(Date.now())
  useEffect(() => { shownAt.current = Date.now() }, [questionKey])
  return () => {
    const now = Date.now()
    if (!advanceAllowed(shownAt.current, now)) return false
    // Marque l'instant tout de suite : le prochain clic, même dans la foulée, compte déjà depuis ce passage, sans
    // attendre que la nouvelle question soit affichée (l'effet ci-dessus réajuste ensuite à l'affichage réel).
    shownAt.current = now
    return true
  }
}
