import type { HostedQuizSummary } from '../types/hostedQuiz'
import { supabase } from './supabase'

/** Les quiz hébergés auxquels l'utilisateur courant a accès (RLS filtre déjà — un admin les voit tous). */
export async function fetchAccessibleQuizzes(): Promise<HostedQuizSummary[]> {
  const { data, error } = await supabase.from('quizzes').select('id, title, is_public').order('title')
  if (error) throw error
  return data ?? []
}

/** Le contenu brut (non validé) d'un quiz hébergé — à faire passer par `parseQuiz` côté appelant, comme un fichier importé. */
export async function fetchQuizContent(id: string): Promise<unknown> {
  const { data, error } = await supabase.from('quizzes').select('content').eq('id', id).single()
  if (error) throw error
  return data.content
}

/** Admin uniquement (RLS) : crée le quiz s'il n'existe pas, met à jour son contenu sinon (par `title`).
 * N'accorde jamais d'accès automatiquement — c'est à l'admin de le faire ensuite, question par question.
 * Renvoie l'id de la ligne (nouvelle ou existante), utile pour sélectionner un quiz venant d'être créé. */
export async function upsertQuiz(title: string, content: unknown): Promise<string> {
  const { data: userData } = await supabase.auth.getUser()
  const { data, error } = await supabase.from('quizzes').upsert(
    { title, content, created_by: userData.user?.id, updated_at: new Date().toISOString() },
    { onConflict: 'title' },
  ).select('id').single()
  if (error) throw error
  return data.id
}

/** Admin uniquement (RLS) : met à jour un quiz existant par `id` — nécessaire dès qu'on renomme un quiz,
 * puisque `upsertQuiz` (par `title`) fusionnerait sinon silencieusement avec la ligne portant l'ancien titre. */
export async function updateQuiz(id: string, title: string, content: unknown): Promise<void> {
  const { error } = await supabase.from('quizzes').update({ title, content, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

/** Admin uniquement (RLS) : supprime définitivement un quiz hébergé. `quiz_access` est nettoyé automatiquement
 * (FK `on delete cascade`) ; l'historique déjà enregistré (parties, classement) n'est pas affecté par défaut. */
export async function deleteQuiz(id: string): Promise<void> {
  const { error } = await supabase.from('quizzes').delete().eq('id', id)
  if (error) throw error
}

/** Admin uniquement (RLS) : rend un quiz hébergé visible par tous les utilisateurs connectés sans octroi
 * d'accès individuel (ou retire cette visibilité par défaut) — cf. policy SELECT de `020_public_quizzes.sql`. */
export async function setQuizPublic(id: string, isPublic: boolean): Promise<void> {
  const { error } = await supabase.from('quizzes').update({ is_public: isPublic }).eq('id', id)
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

/** Admin uniquement (RLS) : les utilisateurs ayant déjà accès à ce quiz. */
export async function fetchAccessGrants(quizId: string): Promise<string[]> {
  const { data, error } = await supabase.from('quiz_access').select('user_id').eq('quiz_id', quizId)
  if (error) throw error
  return (data ?? []).map((row) => row.user_id)
}

export async function grantAccess(quizId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('quiz_access').insert({ quiz_id: quizId, user_id: userId })
  if (error) throw error
}

export async function revokeAccess(quizId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('quiz_access').delete().eq('quiz_id', quizId).eq('user_id', userId)
  if (error) throw error
}
