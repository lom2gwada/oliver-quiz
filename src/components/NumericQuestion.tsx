import type { NumericQuestion as Question, UserAnswer } from '../types/quiz'

export function NumericQuestion({ question, answer, onChange }: { question: Question; answer?: UserAnswer; onChange: (value: string) => void }) {
  const { min, max, step, unit } = question.content
  const value = typeof answer === 'string' && answer !== '' ? Number(answer) : Math.round((min + max) / 2)
  const suffix = unit ? ` ${unit}` : ''
  return <div className="numeric">
    <input type="range" className="numeric-range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(event.target.value)} />
    <div className="numeric-value">{value}{suffix}</div>
    <div className="numeric-bounds"><span>{min}{suffix}</span><span>{max}{suffix}</span></div>
  </div>
}
