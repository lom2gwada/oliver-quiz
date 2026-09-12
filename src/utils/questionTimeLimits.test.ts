import { describe, expect, it } from 'vitest'
import type { BooleanQuestion, MatchingQuestion } from '../types/quiz'
import { questionTimeLimit } from './questionTimeLimits'

const boolQuestion: BooleanQuestion = {
  id: 'q1', theme: 'general', difficulty: 'easy', tags: [], explanation: '', points: 1,
  type: 'boolean', question: 'Vrai ou faux ?', content: { isTrue: true },
}
const matchingQuestion: MatchingQuestion = {
  id: 'q2', theme: 'general', difficulty: 'hard', tags: [], explanation: '', points: 2,
  type: 'matching', question: 'Associez.', content: { left: [], right: [], correctPairs: {} },
}

describe('questionTimeLimit', () => {
  it('uses the question\'s own override when set', () => {
    expect(questionTimeLimit({ ...boolQuestion, timeLimitSeconds: 5 })).toBe(5)
  })

  it('falls back to the default scale by type and difficulty when unset', () => {
    expect(questionTimeLimit(boolQuestion)).toBe(8)
    expect(questionTimeLimit(matchingQuestion)).toBe(45)
  })

  it('gives a longer default to interaction-heavy types than to a quick boolean at the same difficulty', () => {
    const easyMatching: MatchingQuestion = { ...matchingQuestion, difficulty: 'easy' }
    expect(questionTimeLimit(easyMatching)).toBeGreaterThan(questionTimeLimit(boolQuestion))
  })
})
