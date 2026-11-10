import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { BooleanQuestion, Quiz } from '../types/quiz'

vi.mock('../i18n', () => ({ useTranslation: () => ({ t: (key: string) => key, language: 'fr' }) }))
vi.mock('@engine/utils/sound', () => ({ playClick: vi.fn(), playCorrect: vi.fn(), playWrong: vi.fn() }))

import { StreakQuizPage } from './StreakQuizPage'
import { TimedQuizPage } from './TimedQuizPage'

const quiz = { version: '1.0', metadata: { title: 'Quiz', author: 'Moi' }, categories: [{ id: 'general', label: 'Général' }], questions: [] } as unknown as Quiz
const question = (index: number): BooleanQuestion => ({
  id: `q${index}`, category: 'general', difficulty: 'easy', tags: [], explanation: '', points: 1,
  type: 'boolean', question: `Énoncé numéro ${index}.`, content: { isTrue: true },
})
const pool = Array.from({ length: 30 }, (_, index) => question(index))

/** Le premier énoncé affiché par chaque page : c'est celui de la première question de l'ordre de jeu. */
const firstQuestionOf = (html: string) => /Énoncé numéro (\d+)\./.exec(html)?.[1]

describe('sans-faute et contre-la-montre : les questions non découvertes passent en premier', () => {
  const allButOne = new Set(pool.filter((item) => item.id !== 'q17').map((item) => item.id))

  it('la série démarre sur la seule question jamais vue', () => {
    for (let run = 0; run < 20; run += 1) {
      const html = renderToStaticMarkup(createElement(StreakQuizPage, { quiz, pool, seenIds: allButOne, timeboxed: false, onFinish: () => {}, onCancel: () => {} }))
      expect(firstQuestionOf(html)).toBe('17')
    }
  })

  it('le contre-la-montre démarre sur la seule question jamais vue', () => {
    for (let run = 0; run < 20; run += 1) {
      const html = renderToStaticMarkup(createElement(TimedQuizPage, { quiz, pool, seenIds: allButOne, durationSeconds: 600, timeboxed: false, onFinish: () => {}, onCancel: () => {} }))
      expect(firstQuestionOf(html)).toBe('17')
    }
  })

  it('sans l’option, l’ordre reste aléatoire (la première question varie)', () => {
    const firsts = new Set(Array.from({ length: 60 }, () => firstQuestionOf(renderToStaticMarkup(createElement(StreakQuizPage, { quiz, pool, timeboxed: false, onFinish: () => {}, onCancel: () => {} })))))
    expect(firsts.size).toBeGreaterThan(1)
  })
})
