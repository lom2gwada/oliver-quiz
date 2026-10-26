import { describe, expect, it } from 'vitest'
import { EPHEMERAL_VIEWS, hashToRoute, isEphemeralView, routeToHash, type View } from './routes'

const ALL_VIEWS: View[] = ['start', 'quiz', 'results', 'streak', 'streakResults', 'timed', 'timedResults', 'quizzes', 'quizDetail', 'overview', 'history', 'leaderboard', 'profile', 'about']
const QUIZ_ID = '6f1c1c2a-3b2e-4d57-9d38-0a1b2c3d4e5f'

describe('routeToHash', () => {
  it('gives each page its own readable URL', () => {
    expect(routeToHash('start', null)).toBe('#/')
    expect(routeToHash('start', QUIZ_ID)).toBe(`#/quiz/${QUIZ_ID}`)
    expect(routeToHash('history', QUIZ_ID)).toBe(`#/quiz/${QUIZ_ID}/historique`)
    expect(routeToHash('leaderboard', QUIZ_ID)).toBe(`#/quiz/${QUIZ_ID}/classement`)
    expect(routeToHash('leaderboard', null)).toBe('#/classement')
    expect(routeToHash('overview', null)).toBe('#/mes-quiz')
    expect(routeToHash('profile', null)).toBe('#/profil')
    expect(routeToHash('about', null)).toBe('#/a-propos')
    expect(routeToHash('quizzes', null)).toBe('#/admin')
    expect(routeToHash('quizDetail', QUIZ_ID)).toBe(`#/admin/${QUIZ_ID}`)
  })

  it('ignores the quiz for pages that do not belong to one', () => {
    expect(routeToHash('profile', QUIZ_ID)).toBe('#/profil')
    expect(routeToHash('overview', QUIZ_ID)).toBe('#/mes-quiz')
    expect(routeToHash('quizzes', QUIZ_ID)).toBe('#/admin')
  })

  it('gives every view a distinct URL', () => {
    const hashes = ALL_VIEWS.map((view) => routeToHash(view, QUIZ_ID))
    expect(new Set(hashes).size).toBe(ALL_VIEWS.length)
  })

  it('encodes ids that are not URL-safe', () => {
    expect(routeToHash('start', 'a/b c')).toBe('#/quiz/a%2Fb%20c')
  })
})

describe('hashToRoute', () => {
  it.each(ALL_VIEWS)('reads back the URL of the %s page', (view) => {
    const withQuiz = hashToRoute(routeToHash(view, QUIZ_ID))
    const expectedQuiz = ['overview', 'profile', 'about', 'quizzes'].includes(view) ? null : QUIZ_ID
    expect(withQuiz).toEqual({ view, quizId: expectedQuiz })
    const withoutQuiz = hashToRoute(routeToHash(view, null))
    expect(withoutQuiz?.view).toBe(view === 'quizDetail' ? 'quizzes' : view)
    expect(withoutQuiz?.quizId).toBeNull()
  })

  it('treats an empty route as the home page', () => {
    expect(hashToRoute('#/')).toEqual({ view: 'start', quizId: null })
  })

  it('ignores a query string and a trailing slash', () => {
    expect(hashToRoute(`#/quiz/${QUIZ_ID}/classement?mode=streak`)).toEqual({ view: 'leaderboard', quizId: QUIZ_ID })
    expect(hashToRoute('#/profil/')).toEqual({ view: 'profile', quizId: null })
  })

  it('decodes an encoded id', () => {
    expect(hashToRoute('#/quiz/a%2Fb%20c')).toEqual({ view: 'start', quizId: 'a/b c' })
  })

  it('is not fooled by something that is not an app route', () => {
    expect(hashToRoute('')).toBeNull()
    expect(hashToRoute('#')).toBeNull()
    expect(hashToRoute('#access_token=abc&type=invite')).toBeNull()
    expect(hashToRoute('#error=access_denied&error_code=otp_expired')).toBeNull()
    expect(hashToRoute('#/inconnu')).toBeNull()
    expect(hashToRoute(`#/quiz/${QUIZ_ID}/inconnu`)).toBeNull()
    expect(hashToRoute(`#/quiz/${QUIZ_ID}/historique/extra`)).toBeNull()
    expect(hashToRoute('#/quiz/%E0%A4%A')).toBeNull()
    expect(hashToRoute('#/admin/')).toEqual({ view: 'quizzes', quizId: null })
  })
})

describe('ephemeral views', () => {
  it('are the game in progress and the result screens, which cannot be reopened from a URL', () => {
    expect([...EPHEMERAL_VIEWS].sort()).toEqual(['quiz', 'results', 'streak', 'streakResults', 'timed', 'timedResults'])
    expect(isEphemeralView('results')).toBe(true)
    expect(isEphemeralView('history')).toBe(false)
    expect(isEphemeralView('start')).toBe(false)
  })
})
