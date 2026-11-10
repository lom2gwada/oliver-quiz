import { describe, expect, it } from 'vitest'
import { orderUnseenFirst, pickUnseenQuestions, unseenQuestions } from './pickUnseenQuestions'

const questions = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `q${index}` }))
const ids = (items: { id: string }[]) => items.map((item) => item.id)

describe('unseenQuestions', () => {
  it('ne garde que les questions jamais vues', () => {
    const pool = questions(5)
    expect(ids(unseenQuestions(pool, new Set(['q1', 'q3'])))).toEqual(['q0', 'q2', 'q4'])
  })

  it('ignore les ids vus qui ne sont plus dans le pool', () => {
    expect(ids(unseenQuestions(questions(2), new Set(['ancienne-question'])))).toEqual(['q0', 'q1'])
  })
})

describe('orderUnseenFirst', () => {
  it('garde tout le pool et pose d’abord les questions jamais vues, puis les déjà vues', () => {
    const pool = questions(20)
    const seen = new Set(ids(pool.slice(0, 13)))
    for (let run = 0; run < 50; run += 1) {
      const order = orderUnseenFirst(pool, seen)
      expect(order).toHaveLength(20)
      expect(new Set(ids(order)).size).toBe(20)
      expect(order.slice(0, 7).every((question) => !seen.has(question.id))).toBe(true)
      expect(order.slice(7).every((question) => seen.has(question.id))).toBe(true)
    }
  })

  it('mélange simplement le pool sans questions vues', () => {
    const pool = questions(15)
    for (const seen of [null, undefined]) expect(ids(orderUnseenFirst(pool, seen)).sort()).toEqual(ids(pool).sort())
  })

  it('mélange l’ordre à l’intérieur de chaque groupe', () => {
    const pool = questions(40)
    const seen = new Set(ids(pool.slice(0, 20)))
    const orders = new Set(Array.from({ length: 20 }, () => ids(orderUnseenFirst(pool, seen).slice(0, 20)).join()))
    expect(orders.size).toBeGreaterThan(1)
  })

  it('rend un ordre vide pour un pool vide', () => {
    expect(orderUnseenFirst([], new Set(['q0']))).toEqual([])
  })
})

describe('pickUnseenQuestions', () => {
  it('ne tire que des questions non découvertes quand il y en a assez', () => {
    const pool = questions(30)
    const seen = new Set(ids(pool.slice(0, 12)))
    for (let run = 0; run < 50; run += 1) {
      const picked = pickUnseenQuestions(pool, seen, 10)
      expect(picked).toHaveLength(10)
      expect(new Set(ids(picked)).size).toBe(10)
      expect(ids(picked).some((id) => seen.has(id))).toBe(false)
    }
  })

  it('prend toutes les non découvertes puis complète avec des questions déjà vues', () => {
    const pool = questions(20)
    const seen = new Set(ids(pool.slice(0, 17)))
    for (let run = 0; run < 50; run += 1) {
      const picked = pickUnseenQuestions(pool, seen, 10)
      expect(picked).toHaveLength(10)
      expect(new Set(ids(picked)).size).toBe(10)
      expect(ids(picked)).toEqual(expect.arrayContaining(['q17', 'q18', 'q19']))
      expect(ids(picked).filter((id) => seen.has(id))).toHaveLength(7)
    }
  })

  it('en complétant, évite les questions de la partie précédente tant que le pool le permet', () => {
    const pool = questions(20)
    const seen = new Set(ids(pool.slice(0, 18)))
    const previous = pool.slice(0, 5)
    for (let run = 0; run < 50; run += 1) {
      const picked = pickUnseenQuestions(pool, seen, 10, previous)
      expect(picked).toHaveLength(10)
      expect(ids(picked)).toEqual(expect.arrayContaining(['q18', 'q19']))
      expect(ids(picked).some((id) => ids(previous).includes(id))).toBe(false)
    }
  })

  it('retombe sur le tirage habituel quand tout a été vu', () => {
    const pool = questions(15)
    const picked = pickUnseenQuestions(pool, new Set(ids(pool)), 10)
    expect(picked).toHaveLength(10)
    expect(new Set(ids(picked)).size).toBe(10)
  })

  it('rend tout le pool quand on en demande au moins autant qu’il en contient', () => {
    const pool = questions(6)
    expect(ids(pickUnseenQuestions(pool, new Set(['q0', 'q1']), 10)).sort()).toEqual(ids(pool))
  })

  it('rend un tirage vide pour un pool vide', () => {
    expect(pickUnseenQuestions([], new Set(), 5)).toEqual([])
  })
})
