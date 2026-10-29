import { describe, expect, it } from 'vitest'
import type { QuizResultRow, StreakResultRow, TimedResultRow } from '../types/history'
import { mergeGames } from './historyGames'

const classic = (id: string, created_at: string) => ({ id, created_at }) as QuizResultRow
const streak = (id: string, created_at: string) => ({ id, created_at }) as StreakResultRow
const timed = (id: string, created_at: string, question_count = 5) => ({ id, created_at, question_count }) as TimedResultRow

describe('mergeGames', () => {
  it('puts the games of every mode in one list, the most recent first', () => {
    const games = mergeGames(
      [classic('c1', '2026-10-01T10:00:00Z'), classic('c2', '2026-09-01T10:00:00Z')],
      [streak('s1', '2026-10-03T10:00:00Z')],
      [timed('t1', '2026-09-15T10:00:00Z')],
    )
    expect(games.map((game) => [game.mode, game.id])).toEqual([['streak', 's1'], ['classic', 'c1'], ['timed', 't1'], ['classic', 'c2']])
  })

  it('counts each game once, so the tab total is the « parties jouées » of the summary', () => {
    expect(mergeGames([classic('c1', '2026-10-01T10:00:00Z')], [streak('s1', '2026-10-02T10:00:00Z'), streak('s2', '2026-10-03T10:00:00Z')], [timed('t1', '2026-10-04T10:00:00Z')])).toHaveLength(4)
  })

  it('leaves out a timed game in which no question was attempted', () => {
    const games = mergeGames([], [], [timed('empty', '2026-10-01T10:00:00Z', 0), timed('real', '2026-10-02T10:00:00Z', 7)])
    expect(games.map((game) => game.id)).toEqual(['real'])
  })

  it('keeps the original row of each game, for the mode-specific columns', () => {
    const [game] = mergeGames([], [streak('s1', '2026-10-03T10:00:00Z')], [])
    expect(game.mode === 'streak' && game.row.id).toBe('s1')
  })

  it('returns nothing without any game', () => {
    expect(mergeGames([], [], [])).toEqual([])
  })
})
