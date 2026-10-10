const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

interface RetryOptions {
  /** Délai avant chaque nouvel essai : `[600, 1800]` = 3 essais au total (1 + 2 reprises). */
  delaysMs: number[]
  /** Appelé avant chaque reprise, avec l'erreur qui vient de survenir (ex. renouveler un jeton rejeté). */
  onRetry?: (error: unknown) => void | Promise<void>
  /** Injectable pour les tests. */
  sleep?: (ms: number) => Promise<void>
}

/** Rejoue `task` après chaque échec, jusqu'à épuisement des délais, puis relance la dernière erreur. À réserver
 * aux opérations idempotentes (lectures, écritures d'un état absolu) : une reprise après une réponse perdue
 * rejouerait une opération qui a peut-être déjà réussi. */
export async function retryWithBackoff<T>(task: () => Promise<T>, { delaysMs, onRetry, sleep = wait }: RetryOptions): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await task()
    } catch (error) {
      if (attempt >= delaysMs.length) throw error
      await sleep(delaysMs[attempt])
      await onRetry?.(error)
    }
  }
}
