// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fr } from '../i18n/fr'
import type { Question, Quiz } from '../types/quiz'

vi.mock('../i18n', () => ({
  useTranslation: () => ({ t: (key: keyof typeof fr, ...args: unknown[]) => { const value = fr[key] as unknown; return typeof value === 'function' ? (value as (...a: unknown[]) => string)(...args) : value }, language: 'fr' }),
}))
vi.mock('../utils/supabase', () => ({ supabase: {} }))
vi.mock('../utils/confirmDialog', () => ({ confirmDialog: vi.fn(async () => true) }))
vi.mock('./ListenButton', () => ({ ListenButton: () => null }))
vi.mock('@engine/utils/sound', () => ({ playClick: vi.fn() }))

import { QuizPage } from './QuizPage'
import { StreakQuizPage } from './StreakQuizPage'
import { TimedQuizPage } from './TimedQuizPage'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const qcm = (id: string, prompt: string, overrides: Partial<Question> = {}): Question => ({
  id, type: 'qcm', category: 'general', difficulty: 'easy', question: prompt, tags: [], explanation: '', points: 10,
  content: { multiple: false, answers: [{ id: `${id}-a`, label: 'Alpha', isCorrect: true }, { id: `${id}-b`, label: 'Beta', isCorrect: false }] },
  ...overrides,
} as Question)
const quiz = (questions: Question[]): Quiz => ({
  version: '1', metadata: { title: 'Quiz test', author: 'A', createdAt: '2026-11-24' },
  categories: [{ id: 'general', label: 'Général' }], questions,
})

let container: HTMLDivElement
let root: Root
const noop = () => {}

beforeEach(() => { vi.useFakeTimers(); container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers() })

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() })
const tick = (ms: number) => act(async () => { vi.advanceTimersByTime(ms) })
// Le décompte d'une question s'enchaîne seconde après seconde, à chaque rendu : on avance une seconde à la fois.
const tickSeconds = async (seconds: number) => { for (let i = 0; i < seconds; i++) await tick(1000) }
const mount = async (element: ReturnType<typeof createElement>) => { await act(async () => { root.render(element) }); await flush() }
const editButton = () => [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Modifier')) as HTMLButtonElement | undefined
const dialog = () => container.querySelector('dialog')
const metaText = () => container.querySelector('.question-meta')?.textContent ?? ''
const heading = () => container.querySelector('.question-body h2')?.textContent ?? ''
const click = async (element: Element | null | undefined) => { expect(element, 'element to click').toBeTruthy(); await act(async () => { (element as HTMLElement).click() }); await flush() }
const buttonIn = (parent: ParentNode, text: string) => [...parent.querySelectorAll('button')].find((button) => button.textContent?.includes(text)) as HTMLButtonElement | undefined
async function typePrompt(value: string) {
  const textarea = dialog()!.querySelector('textarea') as HTMLTextAreaElement
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, value)
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const save = async () => { await click(buttonIn(dialog()!, 'Enregistrer')) }
const checkedOptions = () => container.querySelectorAll('.question-body input:checked').length
const pickFirstOption = async () => { await click(container.querySelector('.question-body input')) }

const first = qcm('q1', 'Première question ?')
const second = qcm('q2', 'Seconde question ?')

/** Les trois modes de jeu, montés de la même façon : `edit` absent, ou présent (administrateur du quiz). */
const modes: { name: string; render: (edit?: (updated: Question) => Promise<void>, questions?: Question[]) => ReturnType<typeof createElement>; elapsedText: RegExp }[] = [
  { name: 'classic', elapsedText: /⏱ 0:0\d/, render: (edit, questions = [first, second]) => createElement(QuizPage, { quiz: quiz(questions), questions, timeboxed: false, onFinish: noop, onCancel: noop, onEditQuestion: edit }) },
  { name: 'streak', elapsedText: /⏱ 0:0\d/, render: (edit, questions = [first, second]) => createElement(StreakQuizPage, { quiz: quiz(questions), pool: questions, timeboxed: false, onFinish: noop, onCancel: noop, onEditQuestion: edit }) },
  { name: 'timed', elapsedText: /⏱ 0:\d\d/, render: (edit, questions = [first, second]) => createElement(TimedQuizPage, { quiz: quiz(questions), pool: questions, durationSeconds: 0, timeboxed: false, onFinish: noop, onCancel: noop, onEditQuestion: edit }) },
]

describe.each(modes)('editing the current question while playing — $name mode', ({ render }) => {
  // Les modes mélangent les questions : on repère laquelle est affichée plutôt que de supposer l'ordre.
  const shown = () => heading()

  it('offers no edit button to a player', async () => {
    await mount(render(undefined))
    expect(editButton()).toBeUndefined()
    expect(dialog()).toBeNull()
  })

  it('offers the button, and opens the form of the question on screen', async () => {
    await mount(render(async () => {}))
    expect(editButton()).toBeDefined()
    expect(dialog()).toBeNull()
    const before = shown()
    await click(editButton())
    expect(dialog()).not.toBeNull()
    expect(dialog()!.textContent).toContain('Modifier la question')
    expect((dialog()!.querySelector('textarea') as HTMLTextAreaElement).value).toBe(before)
  })

  it('saves through the callback, then shows the new wording right away and closes the window', async () => {
    const edit = vi.fn(async () => {})
    await mount(render(edit, [first]))
    await click(editButton())
    await typePrompt('Première question, corrigée ?')
    await save()
    expect(edit).toHaveBeenCalledTimes(1)
    expect((edit.mock.calls[0] as unknown as [Question])[0]).toMatchObject({ id: 'q1', question: 'Première question, corrigée ?' })
    expect(shown()).toBe('Première question, corrigée ?')
    expect(dialog()).toBeNull()
  })

  it('keeps the window open and says why when the quiz refuses the change', async () => {
    const edit = vi.fn(async () => { throw new Error('Ce quiz a été modifié par quelqu’un d’autre entre-temps.') })
    await mount(render(edit, [first]))
    await click(editButton())
    await typePrompt('Autre énoncé')
    await save()
    expect(dialog()).not.toBeNull()
    expect(dialog()!.querySelector('[role=alert]')?.textContent).toBe('Ce quiz a été modifié par quelqu’un d’autre entre-temps.')
    expect(shown()).toBe('Première question ?')
  })

  it('keeps the answer already given when only the wording changes', async () => {
    await mount(render(async () => {}, [first]))
    await pickFirstOption()
    expect(checkedOptions()).toBe(1)
    await click(editButton())
    await typePrompt('Énoncé corrigé')
    await save()
    expect(checkedOptions()).toBe(1)
  })

  it('clears the answer already given when the proposed answers change', async () => {
    await mount(render(async () => {}, [first]))
    await pickFirstOption()
    expect(checkedOptions()).toBe(1)
    await click(editButton())
    await click(buttonIn(dialog()!, 'Ajouter une réponse'))
    await save()
    expect(checkedOptions()).toBe(0)
    expect(container.querySelectorAll('.question-body input').length).toBe(3)
  })

  it('closes without saving on Cancel, leaving the question as it was', async () => {
    const edit = vi.fn(async () => {})
    await mount(render(edit, [first]))
    await click(editButton())
    await typePrompt('Jamais enregistré')
    await click(buttonIn(dialog()!, 'Annuler'))
    expect(edit).not.toHaveBeenCalled()
    expect(dialog()).toBeNull()
    expect(shown()).toBe('Première question ?')
  })
})

describe.each(modes)('the timers while the edit window is open — $name mode', ({ render, elapsedText }) => {
  it('stops the game clock while the window is open and resumes it after', async () => {
    await mount(render(async () => {}, [first]))
    await tick(3000)
    const running = metaText().match(elapsedText)
    expect(running).not.toBeNull()
    await click(editButton())
    const paused = metaText()
    await tick(20000)
    expect(metaText()).toBe(paused)
    await click(buttonIn(dialog()!, 'Annuler'))
    await tick(2000)
    expect(metaText()).not.toBe(paused)
  })
})

describe('the per-question timer while the edit window is open', () => {
  const timedQuestion = qcm('q1', 'Question chronométrée ?', { timeLimitSeconds: 10 })

  it('does not run out while the window is open, and carries on afterwards', async () => {
    const onFinish = vi.fn()
    await mount(createElement(QuizPage, { quiz: quiz([timedQuestion, second]), questions: [timedQuestion, second], timeboxed: true, onFinish, onCancel: noop, onEditQuestion: async () => {} }))
    await tickSeconds(4)
    expect(metaText()).toContain('⏳ 6s')
    await click(editButton())
    await tickSeconds(60)
    expect(metaText()).toContain('⏳ 6s')
    expect(dialog()).not.toBeNull()
    await click(buttonIn(dialog()!, 'Annuler'))
    await tickSeconds(2)
    expect(metaText()).toContain('⏳ 4s')
  })
})

describe('what the game keeps of an edit', () => {
  it('shows the new version every time a question comes back in the timed mode', async () => {
    await mount(createElement(TimedQuizPage, { quiz: quiz([first]), pool: [first], durationSeconds: 0, timeboxed: false, onFinish: noop, onCancel: noop, onEditQuestion: async () => {} }))
    await click(editButton())
    await typePrompt('Version corrigée')
    await save()
    await click(buttonIn(container, 'Suivante'))
    await tick(1000)
    expect(heading()).toBe('Version corrigée')
  })

  it('does not reshuffle or restart a streak when the quiz underneath is updated by the edit', async () => {
    const many = [qcm('a', 'Question A ?'), qcm('b', 'Question B ?'), qcm('c', 'Question C ?'), qcm('d', 'Question D ?')]
    const props = (pool: Question[], edit: (updated: Question) => Promise<void>) => createElement(StreakQuizPage, { quiz: quiz(pool), pool, timeboxed: false, onFinish: noop, onCancel: noop, onEditQuestion: edit })
    await mount(props(many, async () => {}))
    const before = heading()
    // L'application remplace le quiz (donc `pool`) après l'enregistrement : l'ordre de la série ne doit pas changer.
    await mount(props(many.map((question) => ({ ...question })), async () => {}))
    expect(heading()).toBe(before)
  })

  it('hands the edited question, not the old one, to the end of a classic game', async () => {
    const onFinish = vi.fn()
    await mount(createElement(QuizPage, { quiz: quiz([first]), questions: [first], timeboxed: false, onFinish, onCancel: noop, onEditQuestion: async () => {} }))
    await click(editButton())
    await typePrompt('Version corrigée')
    await save()
    vi.advanceTimersByTime(1000)
    await click(buttonIn(container, 'Voir ma correction'))
    expect(onFinish).toHaveBeenCalledTimes(1)
    const played = (onFinish.mock.calls[0] as unknown as [unknown, unknown, Question[]])[2]
    expect(played[0].question).toBe('Version corrigée')
  })
})
