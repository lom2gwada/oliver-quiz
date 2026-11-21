import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { fr } from '../i18n/fr'
import type { AdminUser, AdminUserDetail } from '../utils/adminUsers'

vi.mock('../i18n', () => ({
  useTranslation: () => ({ t: (key: keyof typeof fr, ...args: unknown[]) => { const value = fr[key] as unknown; return typeof value === 'function' ? (value as (...a: unknown[]) => string)(...args) : value }, language: 'fr' }),
}))

import { UserListView } from './UsersPage'
import { UserDetailView } from './UserDetailPage'

const user = (pseudo: string, overrides: Partial<AdminUser> = {}): AdminUser => ({
  user_id: `id-${pseudo}`, pseudo, avatar: '🦊', email: `${pseudo.toLowerCase()}@example.com`, is_admin: false,
  created_at: '2026-08-26T12:00:00Z', last_sign_in_at: '2026-10-26T12:00:00Z', disabled: false, games_played: 0, last_played_at: null,
  ...overrides,
})
const everyone = [
  user('Alice', { is_admin: true, games_played: 453 }),
  user('Bob', { last_sign_in_at: null }),
  user('Carl', { disabled: true, games_played: 1 }),
]

const noop = () => {}
const list = (props: Partial<Parameters<typeof UserListView>[0]> = {}) => ({ users: everyone, search: '', filter: 'all' as const, sort: 'pseudo' as const, onSearchChange: noop, onFilterChange: noop, onSortChange: noop, onOpenUser: noop, ...props })
const render = (props: Partial<Parameters<typeof UserListView>[0]> = {}) => renderToStaticMarkup(createElement(UserListView, list(props)))

/** Tous les éléments `type` de l'arbre rendu (le composant est appelé directement : son seul hook est simulé ci-dessus). */
function findAll(node: ReactNode, type: string, found: ReactElement<{ onClick?: () => void; children?: ReactNode }>[] = []) {
  if (Array.isArray(node)) node.forEach((child) => findAll(child, type, found))
  else if (isValidElement<{ onClick?: () => void; children?: ReactNode }>(node)) {
    if (node.type === type) found.push(node)
    findAll(node.props.children, type, found)
  }
  return found
}

describe('UserListView', () => {
  it('shows each user with email, registration, last sign-in and games', () => {
    const html = render()
    for (const pseudo of ['Alice', 'Bob', 'Carl']) expect(html).toContain(pseudo)
    expect(html).toContain('alice@example.com')
    expect(html).toMatch(/inscrit le 26 août 2026/)
    expect(html).toMatch(/dernière connexion le 26 oct\.? 2026/)
    expect(html).toContain('453 parties')
    expect(html).toContain('1 partie<')
  })

  it('flags administrators, disabled accounts and accounts never signed in', () => {
    const html = render()
    expect(html).toContain('Administrateur')
    expect(html).toContain('users-badge-disabled')
    expect(html).toContain('users-badge-never')
    expect(html).toContain('jamais connecté')
  })

  it('summarises the whole group', () => {
    expect(render()).toContain('3 utilisateurs — 1 administrateur, 1 désactivé, 1 jamais connecté')
  })

  it('applies the search and the filter, and says how many users are shown', () => {
    const searched = render({ search: 'bob' })
    expect(searched).toContain('Bob')
    expect(searched).not.toContain('Alice')
    expect(searched).toContain('1 utilisateur sur 3')
    const filtered = render({ filter: 'admins' })
    expect(filtered).toContain('Alice')
    expect(filtered).not.toContain('Carl')
  })

  it('says so when nobody matches', () => {
    const html = render({ search: 'zzz' })
    expect(html).toContain('Aucun utilisateur ne correspond')
    expect(html).not.toContain('overview-card')
  })

  it('does not show a results line when nothing narrows the list', () => {
    expect(render()).not.toContain('role="status"')
  })

  it('sorts as asked', () => {
    const byGames = render({ sort: 'games' })
    expect(byGames.indexOf('Alice')).toBeLessThan(byGames.indexOf('Carl'))
    expect(byGames.indexOf('Carl')).toBeLessThan(byGames.indexOf('Bob'))
  })

  it('does not fail on a user without email', () => {
    expect(render({ users: [user('Dana', { email: null })] })).toContain('email inconnu')
  })

  it('opens the profile of the user whose card was pressed', () => {
    const opened: string[] = []
    const tree = UserListView(list({ onOpenUser: (id) => opened.push(id) }))
    const buttons = findAll(tree, 'button')
    expect(buttons).toHaveLength(3)
    buttons[1].props.onClick?.()
    expect(opened).toEqual(['id-Bob'])
  })
})

const detail = (overrides: Partial<AdminUserDetail> = {}): AdminUserDetail => ({
  ...user('Alice', { is_admin: true, games_played: 453, last_played_at: '2026-10-26T12:00:00Z' }),
  games: { classic: 410, streak: 23, timed: 20 },
  quizzes: [
    { quiz_id: 'q1', quiz_title: 'Culture générale', question_count: 74, seen_count: 37, games_played: 30, last_played_at: '2026-10-26T12:00:00Z', has_access: false, is_public: true },
    { quiz_id: 'q2', quiz_title: 'Java — Niveau Expert', question_count: 100, seen_count: 10, games_played: 2, last_played_at: null, has_access: true, is_public: false },
    { quiz_id: 'q3', quiz_title: 'Quiz privé', question_count: 50, seen_count: 0, games_played: 0, last_played_at: null, has_access: false, is_public: false },
  ],
  ...overrides,
})
const renderDetail = (overrides: Partial<AdminUserDetail> = {}) => renderToStaticMarkup(createElement(UserDetailView, { detail: detail(overrides) }))

describe('UserDetailView', () => {
  it('shows the information of the account', () => {
    const html = renderDetail()
    expect(html).toContain('alice@example.com')
    expect(html).toContain('Administrateur')
    expect(html).toContain('Actif')
    expect(html).toMatch(/26 août 2026/)
  })

  it('shows the games in total and by mode', () => {
    const html = renderDetail()
    for (const value of ['453', '410', '23', '20']) expect(html).toContain(`>${value}<`)
    expect(html).toContain('Classique')
    expect(html).toContain('Sans-faute')
    expect(html).toContain('Contre-la-montre')
  })

  it('lists only the quizzes the user can open or has played, with their progress', () => {
    const html = renderDetail()
    expect(html).toContain('Culture générale')
    expect(html).toContain('Java — Niveau Expert')
    expect(html).not.toContain('Quiz privé')
    expect(html).toContain('37/74 questions vues')
    expect(html).toContain('Quiz public')
    expect(html).toContain('Accès accordé')
    expect((html.match(/role="progressbar"/g) ?? []).length).toBe(2)
  })

  it('says that only totals are shown, not detailed answers', () => {
    expect(renderDetail()).toContain('Seuls des totaux sont affichés')
  })

  it('says so when there is no quiz to show', () => {
    expect(renderDetail({ quizzes: [] })).toContain('Aucun quiz accessible ni joué')
  })

  it('shows a dash for dates that do not exist yet', () => {
    const html = renderDetail({ last_sign_in_at: null, last_played_at: null, games_played: 0, games: { classic: 0, streak: 0, timed: 0 } })
    expect(html).toContain('<dd>—</dd>')
    expect(html).toContain('Jamais connecté')
  })

  it('marks a disabled account', () => {
    const html = renderDetail({ disabled: true })
    expect(html).toContain('users-badge-disabled')
    expect(html).toContain('Désactivé')
  })
})
