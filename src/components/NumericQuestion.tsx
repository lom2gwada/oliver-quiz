import { useEffect } from 'react'
import type { NumericQuestion as Question, UserAnswer } from '../types/quiz'

export function NumericQuestion({ question, answer, onChange }: { question: Question; answer?: UserAnswer; onChange: (value: string) => void }) {
  const { min, max, step, unit } = question.content
  const value = typeof answer === 'string' && answer !== '' ? Number(answer) : Math.round((min + max) / 2)
  const suffix = unit ? ` ${unit}` : ''

  // Si la valeur du curseur au premier rendu (son milieu) est déjà la bonne réponse et que l'utilisateur ne
  // touche à rien, la réponse ne doit pas rester vide pour autant : on l'initialise à la valeur affichée dès
  // le montage (une fois par question, le composant est remonté à chaque changement via `key={question.id}`
  // chez tous les appelants).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (typeof answer !== 'string' || answer === '') onChange(String(value)) }, [])

  return <div className="numeric">
    <input type="range" className="numeric-range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(event.target.value)} autoFocus />
    <div className="numeric-value">{value}{suffix}</div>
    <div className="numeric-bounds"><span>{min}{suffix}</span><span>{max}{suffix}</span></div>
  </div>
}
