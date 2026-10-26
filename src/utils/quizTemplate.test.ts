import { describe, expect, it } from 'vitest'
import { buildQuizTemplate } from './quizTemplate'
import { parseQuiz, serializeQuiz } from './quizValidation'

const TYPES = ['qcm', 'text', 'code', 'ordering', 'boolean', 'cloze', 'matching', 'numeric']

describe.each(['fr', 'en'] as const)('quiz template (%s)', (language) => {
  const template = buildQuizTemplate(language, '2026-10-27')

  it('passes the same validation as an import', () => {
    expect(() => parseQuiz(template)).not.toThrow()
  })

  it('has one example of each question type', () => {
    const types = parseQuiz(template).questions.map((question) => question.type)
    expect([...types].sort()).toEqual([...TYPES].sort())
  })

  it('uses unique question ids and its own theme', () => {
    const quiz = parseQuiz(template)
    expect(new Set(quiz.questions.map((question) => question.id)).size).toBe(quiz.questions.length)
    expect(quiz.questions.every((question) => question.category === quiz.categories[0].id)).toBe(true)
  })

  it('is in the exchange format and survives a round trip', () => {
    expect(template).toHaveProperty('themes')
    expect(serializeQuiz(parseQuiz(template))).toEqual(template)
  })

  it('declares its language and the given creation date', () => {
    expect(parseQuiz(template).metadata).toMatchObject({ language, createdAt: '2026-10-27' })
  })
})

describe('quiz template', () => {
  it('is written in the requested language', () => {
    expect(JSON.stringify(buildQuizTemplate('fr'))).toContain('capitale de la France')
    expect(JSON.stringify(buildQuizTemplate('en'))).toContain('capital of France')
  })
})
