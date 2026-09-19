import type { GuestLinkMode } from '../types/guestLink'
import type { AnswersByQuestion, Quiz } from '../types/quiz'
import { parseQuiz } from './quizValidation'
import { supabase } from './supabase'

/** Appelable sans compte : passe par la fonction SECURITY DEFINER `fetch_guest_quiz` (les tables restent fermées
 * à `anon`). `null` si le token est inconnu ou révoqué ; lève si le contenu n'est pas un quiz valide. */
export async function fetchGuestQuiz(token: string): Promise<{ mode: GuestLinkMode; quiz: Quiz } | null> {
  const { data, error } = await supabase.rpc('fetch_guest_quiz', { p_token: token })
  if (error) throw error
  if (!data) return null
  return { mode: data.mode, quiz: parseQuiz(data.quiz) }
}

/** `score` (0-100) seulement en mode test, `null` en mode sondage. La fonction côté base ignore silencieusement
 * un token invalide ou des valeurs hors bornes — d'où l'absence d'erreur dans ces cas. */
export async function submitGuestResult(token: string, respondentName: string, answers: AnswersByQuestion, score: number | null, elapsedSeconds: number): Promise<void> {
  const { error } = await supabase.rpc('submit_guest_result', {
    p_token: token, p_respondent_name: respondentName, p_answers: answers, p_score: score, p_elapsed_seconds: elapsedSeconds,
  })
  if (error) throw error
}
