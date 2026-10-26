import { isRejectedJwt } from './jwtErrors'
import { retryWithBackoff } from './retry'
import { supabase } from './supabase'

/** Une écriture à rejouer sans risque : relancée après un échec, elle ne doit jamais dupliquer ni faire avancer deux
 * fois une donnée (insertions par identifiant fourni côté client, écritures d'un état absolu). */
export type SaveJob = () => Promise<void>

/** État de l'enregistrement de la dernière partie, tel que l'écran de résultat l'affiche. `idle` : rien à signaler
 * (en cours, réussi du premier coup ou aucune partie). */
export type SaveStatus =
  | { state: 'idle' | 'recovered' }
  | { state: 'failed' | 'retrying'; jobs: SaveJob[] }

/** Trois essais : immédiat, puis après 0,8 s, puis après 2,4 s (délai croissant) avant d'avertir le joueur. */
export const SAVE_RETRY_DELAYS_MS = [800, 2400]

interface RunOptions {
  delaysMs?: number[]
  /** Injectables pour les tests. */
  sleep?: (ms: number) => Promise<void>
  refreshSession?: () => Promise<unknown>
}

/** Lance les écritures en parallèle, chacune avec ses reprises automatiques (la session est renouvelée avant une
 * reprise si son jeton a été rejeté). Renvoie celles qui ont échoué malgré tout, à proposer au joueur de relancer. */
export async function runSaveJobs(jobs: SaveJob[], { delaysMs = SAVE_RETRY_DELAYS_MS, sleep, refreshSession = () => supabase.auth.refreshSession() }: RunOptions = {}): Promise<SaveJob[]> {
  const outcomes = await Promise.all(jobs.map(async (job) => {
    try {
      await retryWithBackoff(job, { delaysMs, sleep, onRetry: async (error) => { if (isRejectedJwt(error)) await refreshSession() } })
      return null
    } catch (error) {
      console.error("Impossible d'enregistrer la partie.", error)
      return job
    }
  }))
  return outcomes.filter((job): job is SaveJob => job !== null)
}
