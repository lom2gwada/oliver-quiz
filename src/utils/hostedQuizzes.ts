import type { HostedQuizSummary } from '../types/hostedQuiz'
import { isRejectedJwt } from './jwtErrors'
import { retryWithBackoff } from './retry'
import { supabase } from './supabase'

/** Les quiz hébergés auxquels l'utilisateur courant a accès (RLS filtre déjà — un admin les voit tous). */
export async function fetchAccessibleQuizzes(): Promise<HostedQuizSummary[]> {
  const { data, error } = await supabase.from('quizzes').select('id, title, is_public').order('title')
  if (error) throw error
  return data ?? []
}

/** Comme `fetchAccessibleQuizzes`, avec deux reprises (0,6 s puis 1,8 s) — un échec isolé (réseau qui bascule,
 * jeton à renouveler) ne doit pas laisser l'appli sans liste de quiz. Un jeton rejeté est renouvelé avant la
 * reprise : la rejouer avec le même jeton échouerait à l'identique. */
export function fetchAccessibleQuizzesWithRetry(): Promise<HostedQuizSummary[]> {
  return retryWithBackoff(fetchAccessibleQuizzes, {
    delaysMs: [600, 1800],
    onRetry: async (error) => { if (isRejectedJwt(error)) await supabase.auth.refreshSession() },
  })
}

/** Le contenu brut (non validé) d'un quiz hébergé — à faire passer par `parseQuiz` côté appelant, comme un fichier importé. */
export async function fetchQuizContent(id: string): Promise<unknown> {
  const { data, error } = await supabase.from('quizzes').select('content').eq('id', id).single()
  if (error) throw error
  return data.content
}

/** Le quiz a changé depuis que l'appelant l'a chargé (`update_quiz`, 051) : rien n'a été écrit, pour ne pas écraser le travail
 * d'un autre administrateur. L'appelant doit recharger le quiz avant de recommencer. */
export class QuizConflictError extends Error {
  constructor() { super('conflict') }
}

/** Les fonctions d'écriture (051) refusent en levant `conflict` quand la version attendue n'est plus la bonne. */
function rethrow(error: { message?: string }): never {
  if (error.message?.includes('conflict')) throw new QuizConflictError()
  throw error
}

/** Le contenu d'un quiz hébergé avec sa version (`updated_at`, telle que Postgres la rend, microsecondes comprises : ne pas la
 * passer par un `Date`). La version est à renvoyer à `updateQuiz` pour que deux administrateurs ne s'écrasent pas. */
export async function fetchQuizWithVersion(id: string): Promise<{ content: unknown; updatedAt: string }> {
  const { data, error } = await supabase.from('quizzes').select('content, updated_at').eq('id', id).single()
  if (error) throw error
  return { content: data.content, updatedAt: data.updated_at }
}

/** Crée le quiz s'il n'existe pas (administrateur global pour l'instant), met à jour son contenu par `title` sinon (il faut alors
 * administrer ce quiz) : `upsert_quiz`, 051. N'accorde jamais d'accès automatiquement. Renvoie l'id de la ligne (nouvelle ou
 * existante), utile pour sélectionner un quiz venant d'être créé ; le créateur en devient propriétaire. */
export async function upsertQuiz(title: string, content: unknown): Promise<string> {
  const { data, error } = await supabase.rpc('upsert_quiz', { p_title: title, p_content: content })
  if (error) throw error
  return data as string
}

/** Administrateur du quiz : met à jour un quiz existant par `id` (`update_quiz`, 051) — nécessaire dès qu'on renomme un quiz,
 * puisque `upsertQuiz` (par `title`) fusionnerait sinon silencieusement avec la ligne portant l'ancien titre. `expectedVersion` est
 * la version chargée (`fetchQuizWithVersion` ou le retour du dernier `updateQuiz`) : si le quiz a changé depuis, rien n'est écrit
 * et `QuizConflictError` est levée. Renvoie la nouvelle version. */
export async function updateQuiz(id: string, title: string, content: unknown, expectedVersion: string | null): Promise<string> {
  const { data, error } = await supabase.rpc('update_quiz', { p_id: id, p_title: title, p_content: content, p_expected_updated_at: expectedVersion })
  if (error) rethrow(error)
  return data as string
}

/** Propriétaire du quiz : le supprime définitivement (`delete_quiz`, 051). `quiz_access`, les liens invités et la progression de
 * révision partent avec ; l'historique déjà enregistré (parties, classement) reste sous son titre, sauf `purgeHistory`, qui l'efface
 * dans la même opération (les parties des joueurs ne peuvent pas être effacées autrement par un propriétaire). */
export async function deleteQuiz(id: string, purgeHistory = false): Promise<void> {
  const { error } = await supabase.rpc('delete_quiz', { p_quiz_id: id, p_purge_history: purgeHistory })
  if (error) throw error
}

/** Propriétaire du quiz : le rend visible par tous les utilisateurs connectés sans octroi d'accès individuel (ou retire cette
 * visibilité) — `set_quiz_public`, 051 ; cf. la policy SELECT de `020_public_quizzes.sql`. */
export async function setQuizPublic(id: string, isPublic: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_quiz_public', { p_quiz_id: id, p_is_public: isPublic })
  if (error) throw error
}

export interface ProfileSummary {
  id: string
  pseudo: string
  avatar: string
}

/** Admin uniquement (RLS) : tout le monde, pour choisir à qui accorder l'accès à un quiz. */
export async function fetchAllProfiles(): Promise<ProfileSummary[]> {
  const { data, error } = await supabase.from('profiles').select('id, pseudo, avatar').order('pseudo')
  if (error) throw error
  return data ?? []
}

/** Administrateur du quiz (RLS) : les utilisateurs ayant déjà accès à ce quiz. */
export async function fetchAccessGrants(quizId: string): Promise<string[]> {
  const { data, error } = await supabase.from('quiz_access').select('user_id').eq('quiz_id', quizId)
  if (error) throw error
  return (data ?? []).map((row) => row.user_id)
}

/** Accorde l'accès via `admin_set_user_quiz_access` (048) : l'action est inscrite au journal d'audit et reste sans effet si l'accès existe déjà. */
export async function grantAccess(quizId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_set_user_quiz_access', { p_user_id: userId, p_quiz_id: quizId, p_granted: true })
  if (error) throw error
}

export async function revokeAccess(quizId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_set_user_quiz_access', { p_user_id: userId, p_quiz_id: quizId, p_granted: false })
  if (error) throw error
}
