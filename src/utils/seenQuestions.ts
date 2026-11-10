import { retryWithBackoff } from './retry'
import { supabase } from './supabase'

/** Les ids des questions d'un quiz déjà découvertes par l'utilisateur (voir `045_my_seen_question_ids.sql`) : la même
 * notion que la barre « découvert » de l'accueil. Un seul tableau en réponse, pour échapper au plafond de lignes de l'API. */
export async function fetchSeenQuestionIds(quizId: string): Promise<Set<string>> {
  return retryWithBackoff(async () => {
    const { data, error } = await supabase.rpc('my_seen_question_ids', { p_quiz_id: quizId })
    if (error) throw error
    return new Set<string>((data ?? []) as string[])
  }, { delaysMs: [600, 1800] })
}
