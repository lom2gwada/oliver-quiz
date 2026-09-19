import { describe, expect, it } from 'vitest'
import { pickFreshQuestions } from './pickFreshQuestions'

const questions = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `q${index}` }))
const ids = (items: { id: string }[]) => items.map((item) => item.id)

describe('pickFreshQuestions', () => {
  it('never repeats a previous question when the pool has enough unseen ones', () => {
    const pool = questions(20)
    const previous = pool.slice(0, 5)
    for (let run = 0; run < 50; run += 1) {
      const picked = pickFreshQuestions(pool, previous, 10)
      expect(picked).toHaveLength(10)
      expect(ids(picked).some((id) => ids(previous).includes(id))).toBe(false)
    }
  })

  it('draws without duplicates', () => {
    const picked = pickFreshQuestions(questions(30), [], 12)
    expect(new Set(ids(picked)).size).toBe(12)
  })

  it('tops up with previously played questions only as far as needed', () => {
    const pool = questions(12)
    const previous = pool.slice(0, 8)
    const picked = pickFreshQuestions(pool, previous, 10)
    expect(picked).toHaveLength(10)
    expect(ids(picked)).toEqual(expect.arrayContaining(ids(pool.slice(8))))
    expect(new Set(ids(picked)).size).toBe(10)
  })

  it('returns the whole pool when asked for at least as many questions as it holds', () => {
    const pool = questions(6)
    expect(ids(pickFreshQuestions(pool, pool, 10)).sort()).toEqual(ids(pool))
  })

  it('returns an empty draw for an empty pool', () => {
    expect(pickFreshQuestions([], [], 5)).toEqual([])
  })
})
