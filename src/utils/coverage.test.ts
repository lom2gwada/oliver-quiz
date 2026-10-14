import { describe, expect, it } from 'vitest'
import { coveragePercent, coverageTotals, splitCoverage, type QuizCoverage } from './coverage'

const row = (title: string, seen: number, total: number, games: number, last: string | null): QuizCoverage =>
  ({ quiz_id: title, quiz_title: title, question_count: total, seen_count: seen, games_played: games, last_played_at: last, due_count: 0 })

describe('coveragePercent', () => {
  it('arrondit à l’entier inférieur pour ne jamais afficher 100 % trop tôt', () => {
    expect(coveragePercent(199, 200)).toBe(99)
    expect(coveragePercent(200, 200)).toBe(100)
    expect(coveragePercent(1, 1290)).toBe(0)
  })
  it('gère un quiz vide et plafonne à 100 %', () => {
    expect(coveragePercent(0, 0)).toBe(0)
    expect(coveragePercent(12, 10)).toBe(100)
  })
})

describe('splitCoverage', () => {
  it('place les quiz joués par date décroissante puis les quiz jamais joués par titre', () => {
    const { started, untouched } = splitCoverage([
      row('Zeta', 0, 10, 0, null),
      row('Ancien', 5, 10, 2, '2026-09-01T10:00:00Z'),
      row('Alpha', 0, 10, 0, null),
      row('Récent', 3, 10, 1, '2026-10-10T10:00:00Z'),
    ])
    expect(started.map((r) => r.quiz_title)).toEqual(['Récent', 'Ancien'])
    expect(untouched.map((r) => r.quiz_title)).toEqual(['Alpha', 'Zeta'])
  })
  it('considère comme commencé un quiz joué uniquement en sans-faute (aucune question journalisée)', () => {
    const { started } = splitCoverage([row('Série', 0, 10, 3, '2026-10-01T00:00:00Z')])
    expect(started).toHaveLength(1)
  })
})

describe('coverageTotals', () => {
  it('cumule les questions vues et le total sur les quiz commencés', () => {
    expect(coverageTotals([row('A', 5, 10, 1, 'x'), row('B', 15, 30, 1, 'y')])).toEqual({ seen: 20, total: 40, percent: 50 })
  })
})
