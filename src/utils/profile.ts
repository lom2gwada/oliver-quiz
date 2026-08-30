import type { Profile } from '../types/profile'
import { supabase } from './supabase'

export async function fetchProfile(): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('pseudo, avatar, theme').maybeSingle()
  if (error) throw error
  return data
}

export async function saveProfile(profile: Profile): Promise<void> {
  const { error } = await supabase.from('profiles').upsert(profile, { onConflict: 'id' })
  if (error) throw error
}
