import type { TextQuestion as Question, UserAnswer } from '../types/quiz'

export function TextQuestion({ answer, onChange }: { question: Question; answer?: UserAnswer; onChange: (value: string) => void }) {
  return <input className="text-answer" type="text" value={typeof answer === 'string' ? answer : ''} onChange={(event) => onChange(event.target.value)} placeholder="Votre réponse…" />
}
