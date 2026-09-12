import { useEffect, useRef, useState } from 'react'

/**
 * Minuteur par question : repart de `seconds` à chaque changement de `key` (typiquement l'id de la
 * question affichée) et appelle `onTimeout` en arrivant à 0. `seconds` à `null` désactive le minuteur
 * (retourne toujours `null`, `onTimeout` n'est jamais appelé).
 *
 * `onTimeout` est lu depuis une ref plutôt que capturé directement dans l'effet : la fonction passée par
 * l'appelant change à chaque frappe (elle referme sur la réponse en cours), et sans la ref l'effet du
 * décompte appellerait une closure obsolète — donc une réponse plus ancienne que celle réellement à l'écran.
 */
export function useQuestionTimer(key: string, seconds: number | null, onTimeout: () => void): number | null {
  const [remaining, setRemaining] = useState<number | null>(seconds)
  const onTimeoutRef = useRef(onTimeout)
  useEffect(() => { onTimeoutRef.current = onTimeout })

  useEffect(() => { setRemaining(seconds) }, [key, seconds])

  useEffect(() => {
    if (remaining === null) return
    if (remaining <= 0) { onTimeoutRef.current(); return }
    const timeout = setTimeout(() => setRemaining((value) => (value ?? 1) - 1), 1000)
    return () => clearTimeout(timeout)
  }, [remaining])

  return remaining
}
