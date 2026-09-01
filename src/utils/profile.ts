import type { Profile } from '../types/profile'
import { supabase } from './supabase'

export async function fetchProfile(): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('pseudo, avatar, theme, isAdmin:is_admin').maybeSingle()
  if (error) throw error
  return data
}

/** N'envoie jamais `isAdmin` — ce statut ne se change qu'en base, jamais via ce formulaire. */
export async function saveProfile({ pseudo, avatar, theme }: Profile): Promise<void> {
  const { error } = await supabase.from('profiles').upsert({ pseudo, avatar, theme }, { onConflict: 'id' })
  if (error) throw error
}
