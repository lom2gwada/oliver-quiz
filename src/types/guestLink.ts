import type { AnswersByQuestion } from './quiz'

export type GuestLinkMode = 'test' | 'survey'

export interface GuestLink {
  token: string
  quiz_id: string
  mode: GuestLinkMode
  label: string | null
  created_at: string
}

/** Une réponse d'invité (table `guest_results`, lisible par les admins seulement). `score` est un pourcentage
 * 0-100 en mode test, `null` en mode sondage. */
export interface GuestResultRow {
  id: string
  respondent_name: string
  created_at: string
  answers: AnswersByQuestion
  score: number | null
  elapsed_seconds: number
}
