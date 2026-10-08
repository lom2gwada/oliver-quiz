import { describe, expect, it } from 'vitest'
import type { MatchingQuestion, OrderingQuestion } from '../types/quiz'
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
