// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fr } from '../i18n/fr'
import type { Question, QuestionAttempt } from '../types/quiz'

vi.mock('../i18n', () => ({
  useTranslation: () => ({ t: (key: keyof typeof fr, ...args: unknown[]) => { const value = fr[key] as unknown; return typeof value === 'function' ? (value as (...a: unknown[]) => string)(...args) : value }, language: 'fr' }),
  translate: (_language: string, key: keyof typeof fr, ...args: unknown[]) => { const value = fr[key] as unknown; return typeof value === 'function' ? (value as (...a: unknown[]) => string)(...args) : value },
}))
vi.mock('../utils/supabase', () => ({ supabase: {} }))
vi.mock('@engine/utils/sound', () => ({ playClick: vi.fn(), playFinish: vi.fn(), playVictory: vi.fn() }))
vi.mock('./ListenButton', () => ({ ListenButton: () => null }))

import { CorrectionList, type CorrectionItem } from './CorrectionList'
import { ResultPage } from './ResultPage'
import { StreakResultPage } from './StreakResultPage'
import { TimedResultPage } from './TimedResultPage'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const qcm = (id: string, prompt: string, overrides: Partial<Question> = {}): Question => ({
  id, type: 'qcm', category: 'general', difficulty: 'easy', question: prompt, tags: [], explanation: `Explication de ${id}.`, points: 10,
  content: { multiple: false, answers: [{ id: 'a', label: 'Alpha', isCorrect: true }, { id: 'b', label: 'Beta', isCorrect: false }] },
  ...overrides,
} as Question)

/** Cinq questions : les numéros 2 et 4 sont ratées, les autres réussies. */
const questions = [1, 2, 3, 4, 5].map((n) => qcm(`q${n}`, `Énoncé ${n} ?`))
const given = (n: number) => (n === 2 || n === 4 ? ['b'] : ['a'])
const items: CorrectionItem[] = questions.map((question, index) => ({ key: question.id, question, answer: given(index + 1) }))

let container: HTMLDivElement
let root: Root
const restart = vi.fn()
const back = vi.fn()
const scrollIntoView = vi.fn()
const scrollTo = vi.fn()

beforeEach(() => {
  restart.mockReset(); back.mockReset(); scrollIntoView.mockReset(); scrollTo.mockReset()
  Element.prototype.scrollIntoView = scrollIntoView
  window.scrollTo = scrollTo as unknown as typeof window.scrollTo
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove() })

const mount = async (element: ReturnType<typeof createElement>) => { await act(async () => { root.render(element) }) }
const mountList = (props: Partial<Parameters<typeof CorrectionList>[0]> = {}) => mount(createElement(CorrectionList, { items, onRestartSame: restart, onBackToSettings: back, ...props }))
const button = (text: string) => [...container.querySelectorAll('button')].find((candidate) => candidate.textContent?.includes(text)) as HTMLButtonElement | undefined
const click = async (element: Element | null | undefined) => { expect(element, 'element to click').toBeTruthy(); await act(async () => { (element as HTMLElement).click() }) }
const cards = () => [...container.querySelectorAll('article.correction')]
const openCards = () => cards().filter((card) => card.querySelector('.correction-body'))
const titles = (list: Element[]) => list.map((card) => card.querySelector('.correction-title')?.textContent)
const toggleOf = (n: number) => cards().find((card) => card.querySelector('.correction-number')?.textContent === `${n}.`)!.querySelector('.correction-toggle') as HTMLButtonElement
const chip = (n: number) => [...container.querySelectorAll('.correction-chip')][n - 1] as HTMLButtonElement

describe('CorrectionList — what is open to begin with', () => {
  it('opens the missed questions and folds the correct ones', async () => {
    await mountList()
    expect(cards()).toHaveLength(5)
    expect(titles(openCards())).toEqual(['Énoncé 2 ?', 'Énoncé 4 ?'])
    expect(toggleOf(2).getAttribute('aria-expanded')).toBe('true')
    expect(toggleOf(1).getAttribute('aria-expanded')).toBe('false')
  })

  it('shows the whole correction only in an open card: both answers, explanation, replay', async () => {
    await mountList()
    const missed = cards()[1]
    expect(missed.textContent).toContain('Votre réponse : Beta')
    expect(missed.textContent).toContain('Bonne réponse : Alpha')
    expect(missed.textContent).toContain('Explication de q2.')
    expect(missed.textContent).toContain('Revoir la question')
    expect(cards()[0].textContent).not.toContain('Explication de q1.')
  })

  it('says whether a question was right or missed to a screen reader, not only by colour', async () => {
    await mountList()
    expect(toggleOf(1).textContent).toContain('✓ Bonne réponse')
    expect(toggleOf(2).textContent).toContain('✗ Réponse incorrecte')
    expect(chip(1).getAttribute('aria-label')).toBe('Question 1 : réussie')
    expect(chip(2).getAttribute('aria-label')).toBe('Question 2 : à revoir')
  })

  it('counts the questions in the title and the filters', async () => {
    await mountList()
    expect(container.querySelector('h3.stats-group-title')?.textContent).toBe('Correction · 5 questions')
    expect(button('Toutes')?.textContent).toBe('Toutes (5)')
    expect(button('À revoir')?.textContent).toBe('À revoir (2)')
    expect(button('Réussies')?.textContent).toBe('Réussies (3)')
  })

  it('numbers every question in a grid, green or red', async () => {
    await mountList()
    const chips = [...container.querySelectorAll('.correction-chip')]
    expect(chips.map((item) => item.textContent)).toEqual(['1', '2', '3', '4', '5'])
    expect(chips.map((item) => item.classList.contains('incorrect'))).toEqual([false, true, false, true, false])
  })
})

describe('CorrectionList — opening and closing', () => {
  it('opens a folded card on click, and folds an open one', async () => {
    await mountList()
    await click(toggleOf(1))
    expect(toggleOf(1).getAttribute('aria-expanded')).toBe('true')
    expect(cards()[0].textContent).toContain('Explication de q1.')
    await click(toggleOf(2))
    expect(toggleOf(2).getAttribute('aria-expanded')).toBe('false')
    expect(cards()[1].querySelector('.correction-body')).toBeNull()
  })

  it('links each toggle to the content it opens', async () => {
    await mountList()
    const toggle = toggleOf(2)
    expect(container.querySelector(`[id="${toggle.getAttribute('aria-controls')}"]`)).not.toBeNull()
  })

  it('opens everything, then folds everything', async () => {
    await mountList()
    expect(button('Tout déplier')).toBeDefined()
    await click(button('Tout déplier'))
    expect(openCards()).toHaveLength(5)
    expect(button('Tout replier')).toBeDefined()
    expect(button('Tout déplier')).toBeUndefined()
    await click(button('Tout replier'))
    expect(openCards()).toHaveLength(0)
    expect(button('Tout déplier')).toBeDefined()
  })

  it('offers to open everything again when the player folded one of them', async () => {
    await mountList()
    await click(button('Tout déplier'))
    await click(toggleOf(3))
    expect(button('Tout déplier')).toBeDefined()
  })
})

describe('CorrectionList — the filter', () => {
  it('keeps only the questions to review, or only the correct ones', async () => {
    await mountList()
    await click(button('À revoir'))
    expect(titles(cards())).toEqual(['Énoncé 2 ?', 'Énoncé 4 ?'])
    expect(button('À revoir')!.getAttribute('aria-pressed')).toBe('true')
    await click(button('Réussies'))
    expect(titles(cards())).toEqual(['Énoncé 1 ?', 'Énoncé 3 ?', 'Énoncé 5 ?'])
    await click(button('Toutes'))
    expect(cards()).toHaveLength(5)
  })

  it('keeps the grid whole whichever filter is on', async () => {
    await mountList()
    await click(button('À revoir'))
    expect(container.querySelectorAll('.correction-chip')).toHaveLength(5)
  })

  it('opens or folds only the questions on screen', async () => {
    await mountList()
    await click(button('Réussies'))
    await click(button('Tout déplier'))
    expect(openCards()).toHaveLength(3)
    await click(button('Toutes'))
    expect(openCards()).toHaveLength(5)
  })

  it('disables a filter with nothing in it', async () => {
    const perfect = questions.map((question) => ({ key: question.id, question, answer: ['a'] }))
    await mountList({ items: perfect })
    expect(button('À revoir (0)')!.disabled).toBe(true)
    expect(button('Réussies (5)')!.disabled).toBe(false)
    expect(openCards()).toHaveLength(0)
  })
})

describe('CorrectionList — the grid of numbers', () => {
  it('opens the question, scrolls to it and puts the focus on it', async () => {
    await mountList()
    await click(chip(3))
    expect(toggleOf(3).getAttribute('aria-expanded')).toBe('true')
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(toggleOf(3))
  })

  it('leaves a filter that hides the question', async () => {
    await mountList()
    await click(button('À revoir'))
    expect(cards()).toHaveLength(2)
    await click(chip(5))
    expect(button('Toutes')!.getAttribute('aria-pressed')).toBe('true')
    expect(cards()).toHaveLength(5)
    expect(toggleOf(5).getAttribute('aria-expanded')).toBe('true')
  })

  it('keeps the filter when the question is already shown', async () => {
    await mountList()
    await click(button('À revoir'))
    await click(chip(2))
    expect(button('À revoir')!.getAttribute('aria-pressed')).toBe('true')
    expect(cards()).toHaveLength(2)
  })
})

describe('CorrectionList — the foot of the page', () => {
  it('repeats the end-of-game buttons under the list', async () => {
    await mountList()
    const footer = container.querySelector('.correction-footer')!
    const labels = [...footer.querySelectorAll('button')].map((item) => item.textContent)
    expect(labels.some((label) => label?.includes('Rejouer avec les mêmes paramètres'))).toBe(true)
    await click([...footer.querySelectorAll('button')].find((item) => item.textContent?.includes('Rejouer avec les mêmes paramètres')))
    await click([...footer.querySelectorAll('button')].find((item) => item.textContent?.includes('Retour aux paramètres')))
    expect(restart).toHaveBeenCalledTimes(1)
    expect(back).toHaveBeenCalledTimes(1)
  })

  it('has no replay button when replaying makes no sense', async () => {
    await mountList({ onRestartSame: undefined })
    expect(container.querySelector('.correction-footer')!.textContent).not.toContain('Rejouer')
  })

  it('goes back to the top of the page', async () => {
    await mountList()
    await click(button('Haut de page'))
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }))
  })
})

describe('the three result pages share the list', () => {
  const noop = () => {}
  const common = { onRestartSame: noop, onBackToSettings: noop, onViewHistory: noop, onViewLeaderboard: noop, onViewOverview: noop }
  const answers = Object.fromEntries(questions.map((question, index) => [question.id, given(index + 1)]))

  it('classic mode: score unchanged, breakdown folded, corrections folded and filtered', async () => {
    await mount(createElement(ResultPage, { ...common, questions, answers, themes: [{ id: 'general', label: 'Général' }], elapsedSeconds: 65 }))
    expect(container.querySelector('.score')?.textContent).toContain('30 / 50 points')
    const breakdown = container.querySelector('details.result-breakdown') as HTMLDetailsElement
    expect(breakdown).not.toBeNull()
    expect(breakdown.open).toBe(false)
    expect(breakdown.querySelector('summary')?.textContent).toBe('Détail par thème et par difficulté')
    expect(cards()).toHaveLength(5)
    expect(openCards()).toHaveLength(2)
  })

  it('streak mode', async () => {
    await mount(createElement(StreakResultPage, { ...common, streakCount: 1, elapsedSeconds: 30, victory: false, playedQuestions: questions.slice(0, 2), answers }))
    expect(container.querySelector('h3.stats-group-title')?.textContent).toBe('Correction · 2 questions')
    expect(titles(openCards())).toEqual(['Énoncé 2 ?'])
  })

  it('timed mode: a question that came back is listed once per attempt', async () => {
    const attempts: QuestionAttempt[] = [
      { question: questions[0], answer: ['a'] },
      { question: questions[1], answer: ['b'] },
      { question: questions[1], answer: ['a'] },
    ]
    await mount(createElement(TimedResultPage, { ...common, attempts, elapsedSeconds: 30, durationSeconds: 60 }))
    expect(container.querySelector('.score')?.textContent).toContain('2 / 3')
    expect(titles(cards())).toEqual(['Énoncé 1 ?', 'Énoncé 2 ?', 'Énoncé 2 ?'])
    expect(titles(openCards())).toEqual(['Énoncé 2 ?'])
    await click(chip(3))
    expect(openCards()).toHaveLength(2)
  })
})
