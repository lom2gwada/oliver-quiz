import { describe, expect, it } from 'vitest'
import type { HostedQuizSummary } from '../types/hostedQuiz'
import { administeredQuizzes, administersAnyQuiz, quizPermissions, type QuizRoles } from './quizPermissions'

const quiz = (id: string): HostedQuizSummary => ({ id, title: `Quiz ${id}`, is_public: false })
const roles: QuizRoles = { a: 'owner', b: 'admin' }

describe('quizPermissions', () => {
  it('gives the global administrator everything on every quiz', () => {
    expect(quizPermissions('a', true, {})).toEqual({ manage: true, owner: true, level: 'global' })
    expect(quizPermissions('unknown', true, roles).level).toBe('global')
  })

  it('gives an owner everything on their quiz', () => {
    expect(quizPermissions('a', false, roles)).toEqual({ manage: true, owner: true, level: 'owner' })
  })

  it('gives an administrator the management rights but not the owner ones', () => {
    expect(quizPermissions('b', false, roles)).toEqual({ manage: true, owner: false, level: 'admin' })
  })

  it('gives nothing on a quiz the account does not administer', () => {
    expect(quizPermissions('c', false, roles)).toEqual({ manage: false, owner: false, level: null })
  })

  it('gives nothing while no quiz is chosen', () => {
    expect(quizPermissions('', false, roles)).toEqual({ manage: false, owner: false, level: null })
  })
})

describe('administersAnyQuiz', () => {
  it('is true for the global administrator, even with no role', () => {
    expect(administersAnyQuiz(true, {})).toBe(true)
  })

  it('is true for an account that administers at least one quiz', () => {
    expect(administersAnyQuiz(false, { a: 'admin' })).toBe(true)
  })

  it('is false for an ordinary player', () => {
    expect(administersAnyQuiz(false, {})).toBe(false)
  })
})

describe('administeredQuizzes', () => {
  const all = [quiz('a'), quiz('b'), quiz('c')]

  it('lists every quiz for the global administrator', () => {
    expect(administeredQuizzes(all, true, {})).toEqual(all)
  })

  it('lists only the quizzes the account administers, in the same order', () => {
    expect(administeredQuizzes(all, false, roles).map((item) => item.id)).toEqual(['a', 'b'])
  })

  it('lists nothing for an ordinary player, even when quizzes are visible to them', () => {
    expect(administeredQuizzes(all, false, {})).toEqual([])
  })
})
