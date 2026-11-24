import { describe, expect, it } from 'vitest'
import type { Question } from '../types/quiz'
import { answerSurvivesEdit, replaceQuestion } from './questionEdit'

const base = { id: 'q', category: 'c', difficulty: 'easy' as const, question: 'Énoncé', tags: [] as string[], explanation: '', points: 10 }
const qcm = (ids: string[], overrides: Partial<Question> = {}): Question => ({ ...base, type: 'qcm', content: { multiple: false, answers: ids.map((id, index) => ({ id, label: id.toUpperCase(), isCorrect: index === 0 })) }, ...overrides } as Question)
const code = (ids: string[]): Question => ({ ...base, type: 'code', content: { language: 'ts', snippet: '1', multiple: false, answers: ids.map((id) => ({ id, label: id, isCorrect: true })) } })
const ordering = (ids: string[]): Question => ({ ...base, type: 'ordering', content: { items: ids.map((id) => ({ id, label: id })), correctOrder: ids } })
const matching = (left: string[], right: string[]): Question => ({ ...base, type: 'matching', content: { left: left.map((id) => ({ id, label: id })), right: right.map((id) => ({ id, label: id })), correctPairs: {} } })
const bool = (isTrue: boolean): Question => ({ ...base, type: 'boolean', content: { isTrue } })
const text = (expected: string[]): Question => ({ ...base, type: 'text', content: { expectedAnswers: expected, caseSensitive: false } })
const cloze = (expected: string[]): Question => ({ ...base, type: 'cloze', question: 'A ___ B', content: { expectedAnswers: expected, caseSensitive: false } })
const numeric = (target: number): Question => ({ ...base, type: 'numeric', content: { min: 0, max: 100, step: 1, target, tolerance: 0 } })

describe('answerSurvivesEdit', () => {
  it('keeps the answer when only the wording, difficulty, points, theme or explanation change', () => {
    const before = qcm(['a', 'b'])
    expect(answerSurvivesEdit(before, { ...before, question: 'Autre énoncé', difficulty: 'hard', points: 30, category: 'd', explanation: 'Parce que' })).toBe(true)
  })

  it('keeps the answer when the label of a proposed answer, or which one is correct, changes', () => {
    const before = qcm(['a', 'b'])
    const after = { ...before, content: { multiple: false, answers: [{ id: 'a', label: 'Corrigé', isCorrect: false }, { id: 'b', label: 'B', isCorrect: true }] } } as Question
    expect(answerSurvivesEdit(before, after)).toBe(true)
  })

  it('keeps the answer when the proposed answers are only reordered', () => {
    expect(answerSurvivesEdit(qcm(['a', 'b', 'c']), qcm(['c', 'a', 'b']))).toBe(true)
  })

  it('drops the answer when a proposed answer is added, removed or replaced', () => {
    expect(answerSurvivesEdit(qcm(['a', 'b']), qcm(['a', 'b', 'c']))).toBe(false)
    expect(answerSurvivesEdit(qcm(['a', 'b', 'c']), qcm(['a', 'b']))).toBe(false)
    expect(answerSurvivesEdit(qcm(['a', 'b']), qcm(['a', 'x']))).toBe(false)
  })

  it('drops the answer when the type changes', () => {
    expect(answerSurvivesEdit(qcm(['a', 'b']), code(['a', 'b']))).toBe(false)
    expect(answerSurvivesEdit(text(['x']), cloze(['x']))).toBe(false)
    expect(answerSurvivesEdit(bool(true), text(['true']))).toBe(false)
  })

  it('applies the same rule to code, ordering and matching questions', () => {
    expect(answerSurvivesEdit(code(['a', 'b']), code(['a', 'b']))).toBe(true)
    expect(answerSurvivesEdit(code(['a', 'b']), code(['a', 'b', 'c']))).toBe(false)
    expect(answerSurvivesEdit(ordering(['1', '2', '3']), ordering(['3', '1', '2']))).toBe(true)
    expect(answerSurvivesEdit(ordering(['1', '2', '3']), ordering(['1', '2']))).toBe(false)
    expect(answerSurvivesEdit(matching(['l1', 'l2'], ['r1', 'r2']), matching(['l1', 'l2'], ['r1', 'r2']))).toBe(true)
    expect(answerSurvivesEdit(matching(['l1', 'l2'], ['r1', 'r2']), matching(['l1', 'l2', 'l3'], ['r1', 'r2', 'r3']))).toBe(false)
    expect(answerSurvivesEdit(matching(['l1', 'l2'], ['r1', 'r2']), matching(['l1', 'l2'], ['r1', 'rX']))).toBe(false)
  })

  it('keeps a free answer or a true/false choice, whatever the expected answer becomes', () => {
    expect(answerSurvivesEdit(text(['a']), text(['b']))).toBe(true)
    expect(answerSurvivesEdit(cloze(['a']), cloze(['b', 'c']))).toBe(true)
    expect(answerSurvivesEdit(numeric(10), numeric(20))).toBe(true)
    expect(answerSurvivesEdit(bool(true), bool(false))).toBe(true)
  })
})

describe('replaceQuestion', () => {
  const list = [qcm(['a', 'b'], { id: 'one' }), qcm(['a', 'b'], { id: 'two' }), qcm(['a', 'b'], { id: 'three' })]

  it('replaces only the question with the same id, keeping order and the others untouched', () => {
    const updated = { ...list[1], question: 'Modifiée' } as Question
    const result = replaceQuestion(list, updated)
    expect(result.map((question) => question.id)).toEqual(['one', 'two', 'three'])
    expect(result[1]).toBe(updated)
    expect(result[0]).toBe(list[0])
    expect(result[2]).toBe(list[2])
  })

  it('replaces every copy of the question (a timed game can bring one back)', () => {
    const doubled = [...list, list[1]]
    const result = replaceQuestion(doubled, { ...list[1], question: 'Modifiée' } as Question)
    expect(result.filter((question) => question.question === 'Modifiée')).toHaveLength(2)
  })

  it('puts the updated question in the shape the game uses', () => {
    const result = replaceQuestion(list, { ...list[0] } as Question, (question) => ({ ...question, question: 'mise en forme' }) as Question)
    expect(result[0].question).toBe('mise en forme')
    expect(result[1].question).not.toBe('mise en forme')
  })

  it('leaves the list as it was when no question matches, and never mutates it', () => {
    const copy = [...list]
    const result = replaceQuestion(list, qcm(['a'], { id: 'unknown' }))
    expect(result).toEqual(list)
    expect(list).toEqual(copy)
  })
})
