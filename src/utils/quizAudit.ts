import type { AuditEntry } from './adminUserActions'
import { classifyQuizAdminError, QuizAdminError } from './quizAdmins'
import { supabase } from './supabase'

/** Les dernières actions de gestion d'un quiz (administrateurs, accès, visibilité, création, suppression), la plus récente d'abord
 * (`quiz_audit_log`, 053). Réservé à son propriétaire et à l'administrateur global ; des pseudos, jamais d'email.
 *
 * Sans `quizId` : toute l'activité sur les quiz, y compris celle des quiz supprimés et les autorisations de créer des quiz, pour
 * l'administrateur global seulement. */
export async function fetchQuizAuditLog(quizId: string | null, limit = 100): Promise<AuditEntry[]> {
  const { data, error } = await supabase.rpc('quiz_audit_log', { p_quiz_id: quizId, p_limit: limit })
  if (error) throw new QuizAdminError(classifyQuizAdminError(error.message), error.message)
  return Array.isArray(data) ? (data as AuditEntry[]) : []
}
