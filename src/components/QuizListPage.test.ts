import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { HostedQuizSummary } from '../types/hostedQuiz'
import type { QuizRoles } from '../utils/quizPermissions'

vi.mock('../i18n', () => ({ useTranslation: () => ({ t: (key: string) => key, language: 'fr' }) }))
vi.mock('./CreateQuizForm', () => ({ CreateQuizForm: () => createElement('div', { 'data-testid': 'create-form' }) }))

import { QuizListPage } from './QuizListPage'

const quizzes: HostedQuizSummary[] = [
  { id: 'a', title: 'Quiz A', is_public: false },
  { id: 'b', title: 'Quiz B', is_public: true },
]
const noop = () => {}
const render = (props: { isGlobalAdmin: boolean; canCreate: boolean; roles: QuizRoles; hostedQuizzes?: HostedQuizSummary[] }) => renderToStaticMarkup(createElement(QuizListPage, {
  hostedQuizzes: props.hostedQuizzes ?? quizzes, isGlobalAdmin: props.isGlobalAdmin, canCreate: props.canCreate, roles: props.roles,
  onBack: noop, onViewUsers: noop, onSelectQuiz: noop, onCreateQuiz: async () => {}, createError: '', onPublish: noop, publishError: '', publishSuccess: false, publishWarning: '',
}))

describe('QuizListPage — what each kind of administrator sees', () => {
  it('shows the global administrator the Users page, the creation form and the import', () => {
    const html = render({ isGlobalAdmin: true, canCreate: true, roles: {} })
    expect(html).toContain('nav.users')
    expect(html).toContain('data-testid="create-form"')
    expect(html).toContain('admin.createQuizTitle')
    expect(html).toContain('admin.publishQuizTitle')
    expect(html).toContain('Quiz A')
    expect(html).toContain('Quiz B')
  })

  it('shows a quiz administrator the import and their quizzes, but neither Users nor the creation form', () => {
    const html = render({ isGlobalAdmin: false, canCreate: false, roles: { a: 'admin' }, hostedQuizzes: [quizzes[0]] })
    expect(html).not.toContain('nav.users')
    expect(html).not.toContain('data-testid="create-form"')
    expect(html).not.toContain('admin.createQuizTitle')
    expect(html).toContain('admin.publishQuizTitle')
    expect(html).toContain('Quiz A')
    expect(html).not.toContain('Quiz B')
  })

  it('labels each quiz with the role of the account on it', () => {
    const html = render({ isGlobalAdmin: false, canCreate: false, roles: { a: 'owner', b: 'admin' } })
    expect(html).toMatch(/Quiz A<span class="quiz-tile-badge"> quizAdmin\.roleOwner<\/span>/)
    expect(html).toMatch(/quizAdmin\.roleAdmin<\/span>/)
  })

  it('puts no role label on a quiz the account has no role on (the global administrator seeing every quiz)', () => {
    const html = render({ isGlobalAdmin: true, canCreate: true, roles: { a: 'owner' } })
    expect(html.match(/quizAdmin\.roleOwner/g)).toHaveLength(1)
    expect(html).not.toContain('quizAdmin.roleAdmin')
  })
})

describe('QuizListPage — the journal of every quiz', () => {
  it('is offered to the global administrator only', () => {
    expect(render({ isGlobalAdmin: true, canCreate: true, roles: {} })).toContain('quizAudit.globalTitle')
    expect(render({ isGlobalAdmin: true, canCreate: true, roles: {} })).toContain('quizAudit.show')
    const owner = render({ isGlobalAdmin: false, canCreate: true, roles: { a: 'owner' } })
    expect(owner).not.toContain('quizAudit.globalTitle')
    expect(owner).not.toContain('quizAudit.show')
  })

  it('is not loaded until it is asked for', () => {
    expect(render({ isGlobalAdmin: true, canCreate: true, roles: {} })).not.toContain('quizAudit.globalHint')
  })
})
