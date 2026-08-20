import type { OrderingQuestion as Question, UserAnswer } from '../types/quiz'
import { playClick } from '../utils/sound'

export function OrderingQuestion({ question, answer, onChange }: { question: Question; answer?: UserAnswer; onChange: (value: string[]) => void }) {
  const order = Array.isArray(answer) && answer.length ? answer : question.content.items.map((item) => item.id)
  const move = (index: number, direction: -1 | 1) => {
    const next = [...order]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    playClick()
    onChange(next)
  }
  return <ol className="ordering-list">
    {order.map((id, index) => {
      const item = question.content.items.find((entry) => entry.id === id)!
      return <li key={id}><span>{item.label}</span><span><button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Monter">↑</button><button type="button" onClick={() => move(index, 1)} disabled={index === order.length - 1} aria-label="Descendre">↓</button></span></li>
    })}
  </ol>
}
