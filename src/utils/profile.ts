import type { Profile } from '../types/profile'
import { supabase } from './supabase'

/** Filtre explicitement sur son propre id : depuis qu'un admin peut aussi voir tous les profils
 * (pour la gestion des accès aux quiz hébergés), une requête sans filtre lui renverrait toutes les
 * lignes au lieu d'une seule, et `.maybeSingle()` échouerait ("multiple rows returned"). */
export async function fetchProfile(): Promise<Profile | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!userData.user) return null
  const { data, error } = await supabase.from('profiles').select('pseudo, avatar, theme, language, isAdmin:is_admin').eq('id', userData.user.id).maybeSingle()
  if (error) throw error
  return data
}

/** N'envoie jamais `isAdmin` — ce statut ne se change qu'en base, jamais via ce formulaire. */
export async function saveProfile({ pseudo, avatar, theme, language }: Profile): Promise<void> {
  const { error } = await supabase.from('profiles').upsert({ pseudo, avatar, theme, language }, { onConflict: 'id' })
  if (error) throw error
}
