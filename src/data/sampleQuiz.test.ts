import { describe, expect, it } from 'vitest'
import sampleQuiz from './sample-quiz.json'
import { parseQuiz } from '../utils/quizValidation'

describe('sample quiz', () => {
  const quiz = parseQuiz(sampleQuiz)

  it('has the 74 questions the README and the database copy talk about', () => {
    expect(quiz.questions).toHaveLength(74)
  })

  it('uses the three difficulty levels, none of them marginal', () => {
    const count = (difficulty: string) => quiz.questions.filter((question) => question.difficulty === difficulty).length
    for (const difficulty of ['easy', 'medium', 'hard']) expect(count(difficulty), difficulty).toBeGreaterThanOrEqual(5)
  })

  it('mixes at least two difficulty levels in every theme', () => {
    for (const theme of quiz.categories) {
      const levels = new Set(quiz.questions.filter((question) => question.category === theme.id).map((question) => question.difficulty))
      expect(levels.size, theme.label).toBeGreaterThanOrEqual(2)
    }
  })
})
