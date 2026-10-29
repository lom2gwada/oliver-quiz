import { describe, expect, it } from 'vitest'
import sampleQuiz from './sample-quiz.json'
import { parseQuiz } from '../utils/quizValidation'

describe('sample quiz', () => {
  const quiz = parseQuiz(sampleQuiz)

  it('has the 81 questions the database copy has (migrations 037 / 038 / 042 keep both in step)', () => {
    expect(quiz.questions).toHaveLength(81)
  })

  it('uses the three difficulty levels, with a real choice of hard questions', () => {
    const count = (difficulty: string) => quiz.questions.filter((question) => question.difficulty === difficulty).length
    expect(count('easy')).toBeGreaterThanOrEqual(20)
    expect(count('medium')).toBeGreaterThanOrEqual(20)
    expect(count('hard')).toBeGreaterThanOrEqual(12)
  })

  it('has at least one hard question in every theme', () => {
    for (const theme of quiz.categories) {
      const hard = quiz.questions.filter((question) => question.category === theme.id && question.difficulty === 'hard')
      expect(hard.length, theme.label).toBeGreaterThanOrEqual(1)
    }
  })

  it('mixes at least two difficulty levels in every theme', () => {
    for (const theme of quiz.categories) {
      const levels = new Set(quiz.questions.filter((question) => question.category === theme.id).map((question) => question.difficulty))
      expect(levels.size, theme.label).toBeGreaterThanOrEqual(2)
    }
  })

  it('varies the types of the hard questions', () => {
    const types = new Set(quiz.questions.filter((question) => question.difficulty === 'hard').map((question) => question.type))
    expect(types.size).toBeGreaterThanOrEqual(4)
  })

  it('gives every question a unique id', () => {
    const ids = quiz.questions.map((question) => question.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
