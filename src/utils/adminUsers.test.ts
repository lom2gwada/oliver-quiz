import { describe, expect, it } from 'vitest'
import { classifyUserDetailError, filterUsers, sortUsers, summarizeUsers, userStatus, visibleUserQuizzes, type AdminUser, type AdminUserQuiz } from './adminUsers'

const user = (pseudo: string, overrides: Partial<AdminUser> = {}): AdminUser => ({
  user_id: `id-${pseudo}`, pseudo, avatar: '🙂', email: `${pseudo.toLowerCase()}@example.com`, is_admin: false, is_self: false,
  created_at: '2026-08-01T10:00:00Z', last_sign_in_at: '2026-10-01T10:00:00Z', disabled: false, games_played: 0, last_played_at: null,
  ...overrides,
})
const pseudos = (users: AdminUser[]) => users.map((item) => item.pseudo)

const alice = user('Alice', { is_admin: true, created_at: '2026-08-26T00:00:00Z', last_sign_in_at: '2026-10-26T00:00:00Z', games_played: 453 })
const andree = user('Andrée', { email: 'spharlie@example.com', created_at: '2026-08-29T00:00:00Z', last_sign_in_at: '2026-08-29T00:00:00Z', games_played: 5 })
const bob = user('Bob', { created_at: '2026-10-26T00:00:00Z', last_sign_in_at: null, games_played: 0 })
const carl = user('Carl', { disabled: true, created_at: '2026-09-10T00:00:00Z', last_sign_in_at: '2026-09-11T00:00:00Z', games_played: 12 })
const everyone = [carl, bob, andree, alice]

describe('userStatus', () => {
  it('is disabled for a blocked account, even one that never signed in', () => {
    expect(userStatus(carl)).toBe('disabled')
    expect(userStatus({ disabled: true, last_sign_in_at: null })).toBe('disabled')
  })

  it('is never for an account that has not signed in yet, active otherwise', () => {
    expect(userStatus(bob)).toBe('never')
    expect(userStatus(alice)).toBe('active')
  })
})

describe('filterUsers', () => {
  it('keeps everyone without query nor filter', () => {
    expect(filterUsers(everyone, '', 'all')).toEqual(everyone)
    expect(filterUsers(everyone, '   ', 'all')).toEqual(everyone)
  })

  it('searches pseudo and email, ignoring accents and case', () => {
    expect(pseudos(filterUsers(everyone, 'ANDREE', 'all'))).toEqual(['Andrée'])
    expect(pseudos(filterUsers(everyone, 'spharlie', 'all'))).toEqual(['Andrée'])
    expect(pseudos(filterUsers(everyone, 'example.com', 'all')).sort()).toEqual(['Alice', 'Andrée', 'Bob', 'Carl'])
    expect(filterUsers(everyone, 'zzz', 'all')).toEqual([])
  })

  it('does not fail on a user without email', () => {
    expect(pseudos(filterUsers([user('Dana', { email: null })], 'dana', 'all'))).toEqual(['Dana'])
    expect(filterUsers([user('Dana', { email: null })], 'null', 'all')).toEqual([])
  })

  it('filters administrators, blocked accounts and accounts never signed in', () => {
    expect(pseudos(filterUsers(everyone, '', 'admins'))).toEqual(['Alice'])
    expect(pseudos(filterUsers(everyone, '', 'disabled'))).toEqual(['Carl'])
    expect(pseudos(filterUsers(everyone, '', 'never'))).toEqual(['Bob'])
  })

  it('does not count a blocked account that never signed in as "never"', () => {
    const blockedNever = user('Eve', { disabled: true, last_sign_in_at: null })
    expect(filterUsers([blockedNever], '', 'never')).toEqual([])
    expect(filterUsers([blockedNever], '', 'disabled')).toEqual([blockedNever])
  })

  it('combines the search and the filter', () => {
    expect(pseudos(filterUsers(everyone, 'a', 'admins'))).toEqual(['Alice'])
    expect(filterUsers(everyone, 'bob', 'admins')).toEqual([])
  })
})

describe('sortUsers', () => {
  it('sorts by pseudo, ignoring accents and case', () => {
    expect(pseudos(sortUsers([user('zoé'), user('Émile'), user('anna')], 'pseudo'))).toEqual(['anna', 'Émile', 'zoé'])
  })

  it('puts the most recent registrations first', () => {
    expect(pseudos(sortUsers(everyone, 'created'))).toEqual(['Bob', 'Carl', 'Andrée', 'Alice'])
  })

  it('puts the most recent sign-ins first and the accounts never signed in last', () => {
    expect(pseudos(sortUsers(everyone, 'lastSignIn'))).toEqual(['Alice', 'Carl', 'Andrée', 'Bob'])
  })

  it('puts the busiest players first, ties in alphabetical order', () => {
    expect(pseudos(sortUsers([...everyone, user('Abel', { games_played: 5 })], 'games'))).toEqual(['Alice', 'Carl', 'Abel', 'Andrée', 'Bob'])
  })

  it('does not modify the list it is given', () => {
    const copy = [...everyone]
    sortUsers(everyone, 'pseudo')
    expect(everyone).toEqual(copy)
  })
})

describe('summarizeUsers', () => {
  it('counts administrators, blocked accounts and accounts never signed in', () => {
    expect(summarizeUsers(everyone)).toEqual({ total: 4, admins: 1, disabled: 1, never: 1 })
    expect(summarizeUsers([])).toEqual({ total: 0, admins: 0, disabled: 0, never: 0 })
  })
})

describe('visibleUserQuizzes', () => {
  const quiz = (title: string, overrides: Partial<AdminUserQuiz> = {}): AdminUserQuiz => ({
    quiz_id: title, quiz_title: title, question_count: 10, seen_count: 0, games_played: 0, last_played_at: null, has_access: false, is_public: false, ...overrides,
  })

  it('keeps the quizzes the user can open or has already played', () => {
    const quizzes = [quiz('private'), quiz('granted', { has_access: true }), quiz('public', { is_public: true }), quiz('played', { games_played: 2 }), quiz('seen', { seen_count: 3 })]
    expect(visibleUserQuizzes(quizzes).map((item) => item.quiz_title)).toEqual(['granted', 'public', 'played', 'seen'])
  })
})

describe('classifyUserDetailError', () => {
  it('recognises a user that no longer exists', () => {
    expect(classifyUserDetailError('not_found')).toBe('notFound')
  })

  it('treats anything else as a failure to retry', () => {
    expect(classifyUserDetailError('forbidden')).toBe('failed')
    expect(classifyUserDetailError('Failed to fetch')).toBe('failed')
    expect(classifyUserDetailError(undefined)).toBe('failed')
  })
})
