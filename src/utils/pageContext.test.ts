import { describe, expect, it } from 'vitest'
import { breadcrumbFor, isPlayingView, isQuizPage, type CrumbLabels } from './pageContext'
import type { View } from './routes'

const labels: CrumbLabels = { home: 'Accueil', overview: 'Mes quiz', profile: 'Profil', admin: 'Administration', history: 'Historique', leaderboard: 'Classement', quizTitle: 'Java — Niveau Expert' }
const ALL_VIEWS: View[] = ['start', 'quiz', 'results', 'streak', 'streakResults', 'timed', 'timedResults', 'quizzes', 'quizDetail', 'overview', 'history', 'leaderboard', 'profile']

describe('isQuizPage', () => {
  it('is true only for the pages tied to the active quiz', () => {
    expect(ALL_VIEWS.filter(isQuizPage).sort()).toEqual(['history', 'leaderboard', 'quiz', 'results', 'start', 'streak', 'streakResults', 'timed', 'timedResults'])
  })

  it('is false for the pages that are not about a quiz', () => {
    for (const view of ['overview', 'profile', 'quizzes', 'quizDetail'] as View[]) expect(isQuizPage(view)).toBe(false)
  })
})

describe('isPlayingView', () => {
  it('is true for a game in progress only, not for the result screens', () => {
    expect(ALL_VIEWS.filter(isPlayingView).sort()).toEqual(['quiz', 'streak', 'timed'])
  })
})

describe('breadcrumbFor', () => {
  it('has no breadcrumb on the home page nor during a game', () => {
    for (const view of ['start', 'quiz', 'streak', 'timed', 'results', 'streakResults', 'timedResults'] as View[]) expect(breadcrumbFor(view, labels, 'q1')).toEqual([])
  })

  it('names the page after the home link', () => {
    expect(breadcrumbFor('overview', labels, 'q1')).toEqual([{ label: 'Accueil', href: '#/quiz/q1' }, { label: 'Mes quiz' }])
    expect(breadcrumbFor('profile', labels, null)).toEqual([{ label: 'Accueil', href: '#/' }, { label: 'Profil' }])
    expect(breadcrumbFor('history', labels, 'q1').map((crumb) => crumb.label)).toEqual(['Accueil', 'Historique'])
    expect(breadcrumbFor('leaderboard', labels, 'q1').map((crumb) => crumb.label)).toEqual(['Accueil', 'Classement'])
  })

  it('shows the quiz under the administration for the detail page, e.g. "Administration › Java — Niveau Expert"', () => {
    expect(breadcrumbFor('quizDetail', labels, 'q1')).toEqual([
      { label: 'Accueil', href: '#/quiz/q1' },
      { label: 'Administration', href: '#/admin' },
      { label: 'Java — Niveau Expert' },
    ])
    expect(breadcrumbFor('quizzes', labels, 'q1')).toEqual([{ label: 'Accueil', href: '#/quiz/q1' }, { label: 'Administration' }])
  })

  it('never makes the current page a link', () => {
    for (const view of ALL_VIEWS) {
      const crumbs = breadcrumbFor(view, labels, 'q1')
      if (crumbs.length) expect(crumbs[crumbs.length - 1].href).toBeUndefined()
    }
  })
})
