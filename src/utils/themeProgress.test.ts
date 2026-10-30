import { describe, expect, it } from 'vitest'
import { isHostedQuizId, themeProgressViews, toThemeProgressView, type ThemeProgress } from './themeProgress'

const row = (overrides: Partial<ThemeProgress> = {}): ThemeProgress =>
  ({ theme_id: 'histoire', theme_label: 'Histoire', question_count: 20, seen_count: 7, mastered_count: 3, attempts: 12, correct_attempts: 9, ...overrides })

describe('toThemeProgressView', () => {
  it('donne les parts découverte et maîtrisée au dixième inférieur, et le taux de réussite arrondi', () => {
    expect(toThemeProgressView(row())).toMatchObject({ seenPercent: 35, masteredPercent: 15, successRate: 75 })
    expect(toThemeProgressView(row({ question_count: 3, seen_count: 2, mastered_count: 1, attempts: 3, correct_attempts: 2 }))).toMatchObject({ seenPercent: 66.6, masteredPercent: 33.3, successRate: 67 })
  })

  it('ne donne pas de taux de réussite à un thème jamais joué', () => {
    expect(toThemeProgressView(row({ seen_count: 0, mastered_count: 0, attempts: 0, correct_attempts: 0 }))).toMatchObject({ seenPercent: 0, masteredPercent: 0, successRate: null })
  })

  it('n’affiche 100 % que lorsque tout le thème a été vu', () => {
    expect(toThemeProgressView(row({ question_count: 1000, seen_count: 999 })).seenPercent).toBe(99.9)
    expect(toThemeProgressView(row({ question_count: 20, seen_count: 20 })).seenPercent).toBe(100)
  })
})

describe('themeProgressViews', () => {
  it('garde l’ordre des thèmes et écarte ceux qui n’ont aucune question', () => {
    const views = themeProgressViews([row({ theme_id: 'a' }), row({ theme_id: 'vide', question_count: 0, seen_count: 0, mastered_count: 0 }), row({ theme_id: 'b' })])
    expect(views.map((view) => view.theme_id)).toEqual(['a', 'b'])
  })
})

describe('isHostedQuizId', () => {
  it('reconnaît un identifiant de quiz hébergé et pas un titre figé', () => {
    expect(isHostedQuizId('f5c4e9b5-9b3c-4407-b703-2ee5e2d4ecd2')).toBe(true)
    expect(isHostedQuizId('Culture générale')).toBe(false)
  })
})
