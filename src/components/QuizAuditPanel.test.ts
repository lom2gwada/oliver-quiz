// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fr } from '../i18n/fr'
import type { AuditEntry } from '../utils/adminUserActions'

vi.mock('../i18n', () => ({
  useTranslation: () => ({ t: (key: keyof typeof fr, ...args: unknown[]) => { const value = fr[key] as unknown; return typeof value === 'function' ? (value as (...a: unknown[]) => string)(...args) : value }, language: 'fr' }),
}))
vi.mock('../utils/supabase', () => ({ supabase: {} }))
vi.mock('../utils/quizAudit', () => ({ fetchQuizAuditLog: vi.fn() }))

import { fetchQuizAuditLog } from '../utils/quizAudit'
import { QuizAuditPanel } from './QuizAuditPanel'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const fetchLog = fetchQuizAuditLog as unknown as ReturnType<typeof vi.fn>
const row = (id: string, action: AuditEntry['action'], details: Record<string, unknown>, extra: Partial<AuditEntry> = {}): AuditEntry => ({
  id, created_at: '2026-11-24T10:00:00Z', admin_pseudo: 'Olivier', target_pseudo: 'Alice', action, details: { quiz_id: 'q1', quiz_title: 'Culture générale', ...details }, ...extra,
})

let container: HTMLDivElement
let root: Root
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve() })
const mount = async (quizId: string | null) => { await act(async () => { root.render(createElement(QuizAuditPanel, { quizId })) }); await flush() }

beforeEach(() => { fetchLog.mockReset(); container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); container.remove() })

describe('QuizAuditPanel', () => {
  it('lists the actions of a quiz in plain sentences, naming who they are about', async () => {
    fetchLog.mockResolvedValue([row('2', 'add_quiz_admin', { role: 'admin' }), row('1', 'grant_access', {})])
    await mount('q1')
    expect(fetchLog).toHaveBeenCalledWith('q1')
    const items = [...container.querySelectorAll('li')].map((item) => item.textContent ?? '')
    expect(items).toHaveLength(2)
    expect(items[0]).toContain('Olivier a ajouté Alice comme administrateur du quiz « Culture générale »')
    expect(items[1]).toContain('Olivier a accordé à Alice l\'accès au quiz « Culture générale »')
    expect(container.textContent).toContain('Les dernières actions de gestion de ce quiz')
  })

  it('reads the journal of every quiz when there is no quiz', async () => {
    fetchLog.mockResolvedValue([row('1', 'delete_quiz', { purge_history: false })])
    await mount(null)
    expect(fetchLog).toHaveBeenCalledWith(null)
    expect(container.textContent).toContain('y compris ceux qui ont été supprimés')
    expect(container.textContent).toContain('Olivier a supprimé le quiz « Culture générale »')
  })

  it('says when nothing happened yet', async () => {
    fetchLog.mockResolvedValue([])
    await mount('q1')
    expect(container.textContent).toContain('Aucune action enregistrée.')
  })

  it('says when the journal cannot be loaded', async () => {
    fetchLog.mockRejectedValue(new Error('boom'))
    await mount('q1')
    expect(container.querySelector('[role=alert]')?.textContent).toBe('Impossible de charger le journal.')
  })

  it('reloads when another quiz is shown', async () => {
    fetchLog.mockResolvedValue([])
    await mount('q1')
    await mount('q2')
    expect(fetchLog).toHaveBeenLastCalledWith('q2')
  })
})
