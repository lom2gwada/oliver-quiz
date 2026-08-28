import type { LeaderboardRow } from '../types/leaderboard'
import { supabase } from './supabase'

export async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase.from('leaderboard').select('*').order('best_score', { ascending: false })
  if (error) throw error
  return data ?? []
}
