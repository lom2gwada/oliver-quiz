import type { GuestLink, GuestLinkMode, GuestResultRow } from '../types/guestLink'
import { supabase } from './supabase'

/** Admin uniquement (RLS) : les liens invités existants pour un quiz. */
export async function fetchGuestLinks(quizId: string): Promise<GuestLink[]> {
  const { data, error } = await supabase.from('guest_links').select('*').eq('quiz_id', quizId).order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** Admin uniquement (RLS) : crée un lien invité pour un quiz — le token est généré côté base (défaut de colonne). */
export async function createGuestLink(quizId: string, mode: GuestLinkMode, label: string): Promise<GuestLink> {
  const { data: userData } = await supabase.auth.getUser()
  const { data, error } = await supabase.from('guest_links')
    .insert({ quiz_id: quizId, mode, label: label || null, created_by: userData.user?.id })
    .select('*').single()
  if (error) throw error
  return data
}

/** Admin uniquement (RLS) : révoque un lien invité — supprime aussi ses réponses (FK `on delete cascade`). */
export async function deleteGuestLink(token: string): Promise<void> {
  const { error } = await supabase.from('guest_links').delete().eq('token', token)
  if (error) throw error
}

/** Admin uniquement (RLS : policy select sur `guest_results`) : les réponses reçues via un lien, plus récentes d'abord. */
export async function fetchGuestResults(token: string): Promise<GuestResultRow[]> {
  const { data, error } = await supabase.from('guest_results')
    .select('id, respondent_name, created_at, answers, score, elapsed_seconds').eq('token', token).order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}
