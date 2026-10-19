import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CodeQuestion, MatchingQuestion, OrderingQuestion, QCMQuestion, Question } from '../types/quiz'
import { withShuffledAnswers } from './QuizPage'

const shared = { id: 'q1', theme: 'general', difficulty: 'easy' as const, tags: [], explanation: '', points: 1 }

describe('withShuffledAnswers — ordering', () => {
  const ordering: OrderingQuestion = {
    ...shared, type: 'ordering', question: 'Classez.',
    content: { items: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }], correctOrder: ['a', 'b', 'c'] },
  }

  it('never shows the items already in the correct order', () => {
    for (let run = 0; run < 200; run += 1) {
      const shuffled = withShuffledAnswers(ordering) as OrderingQuestion
      expect(shuffled.content.items.map((item) => item.id)).not.toEqual(ordering.content.correctOrder)
    }
  })

  it('keeps the same items and the same correct order', () => {
    const shuffled = withShuffledAnswers(ordering) as OrderingQuestion
    expect(shuffled.content.items.map((item) => item.id).sort()).toEqual(['a', 'b', 'c'])
    expect(shuffled.content.correctOrder).toEqual(['a', 'b', 'c'])
  })

  it('does not mutate the stored question', () => {
    withShuffledAnswers(ordering)
    expect(ordering.content.items.map((item) => item.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('withShuffledAnswers — matching', () => {
  it('keeps every item and the correct pairs', () => {
    const matching: MatchingQuestion = {
      ...shared, type: 'matching', question: 'Associez.',
      content: { left: [{ id: 'l1', label: 'L1' }, { id: 'l2', label: 'L2' }], right: [{ id: 'r1', label: 'R1' }, { id: 'r2', label: 'R2' }], correctPairs: { l1: 'r1', l2: 'r2' } },
    }
    const shuffled = withShuffledAnswers(matching) as MatchingQuestion
    expect(shuffled.content.left.map((item) => item.id).sort()).toEqual(['l1', 'l2'])
    expect(shuffled.content.right.map((item) => item.id).sort()).toEqual(['r1', 'r2'])
    expect(shuffled.content.correctPairs).toEqual({ l1: 'r1', l2: 'r2' })
  })
})

/** Générateur pseudo-aléatoire à graine fixe : les tests statistiques ci-dessous sont ainsi déterministes. */
function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const options = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `a${index}`, label: `Option ${index}`, isCorrect: index === 0 }))
const qcm = (count: number): QCMQuestion => ({ ...shared, type: 'qcm', question: 'Laquelle ?', content: { multiple: false, answers: options(count) } })
const code = (count: number): CodeQuestion => ({ ...shared, type: 'code', question: 'Que renvoie ce code ?', content: { language: 'javascript', snippet: 'return 1', multiple: false, answers: options(count) } })

/** Fréquence de chaque position d'affichage de la bonne réponse, stockée en première position comme dans les
 * quiz réels (97 à 100 % des QCM hébergés l'ont en premier : seul le mélange à l'affichage évite que la
 * première option soit presque toujours la bonne). */
function correctPositionFrequencies(question: QCMQuestion | CodeQuestion, shuffleQuestion: (question: Question) => Question, runs: number): number[] {
  const counts = new Array(question.content.answers.length).fill(0)
  for (let run = 0; run < runs; run += 1) {
    const shuffled = shuffleQuestion(question) as QCMQuestion | CodeQuestion
    counts[shuffled.content.answers.findIndex((answer) => answer.isCorrect)] += 1
  }
  return counts.map((count) => count / runs)
}

const isUniform = (frequencies: number[], tolerance = 0.02) => frequencies.every((frequency) => Math.abs(frequency - 1 / frequencies.length) < tolerance)

describe('withShuffledAnswers — qcm and code answer positions', () => {
  beforeEach(() => { vi.spyOn(Math, 'random').mockImplementation(seededRandom(20261019)) })
  afterEach(() => { vi.restoreAllMocks() })

  it.each([3, 4, 5])('puts the correct answer at every position equally often (%i options)', (count) => {
    expect(isUniform(correctPositionFrequencies(qcm(count), withShuffledAnswers, 30000))).toBe(true)
  })

  it('shuffles the answers of a code question too', () => {
    expect(isUniform(correctPositionFrequencies(code(4), withShuffledAnswers, 30000))).toBe(true)
  })

  it('has teeth: an unshuffled display (correct answer always first) is detected as biased', () => {
    expect(isUniform(correctPositionFrequencies(qcm(4), (question) => question, 1000))).toBe(false)
  })

  it('keeps every answer with its correctness flag and does not mutate the stored question', () => {
    const question = qcm(4)
    const shuffled = withShuffledAnswers(question) as QCMQuestion
    expect(shuffled.content.answers.map((answer) => [answer.id, answer.isCorrect]).sort()).toEqual(question.content.answers.map((answer) => [answer.id, answer.isCorrect]).sort())
    expect(question.content.answers.map((answer) => answer.id)).toEqual(['a0', 'a1', 'a2', 'a3'])
  })
})
