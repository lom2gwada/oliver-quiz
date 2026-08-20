import type { BooleanQuestion as Question, UserAnswer } from '../types/quiz'
import { playClick } from '../utils/sound'

export function BooleanQuestion({ question, answer, onChange }: { question: Question; answer?: UserAnswer; onChange: (value: string[]) => void }) {
  const selected = Array.isArray(answer) ? answer[0] : undefined
  const choose = (value: 'true' | 'false') => {
    playClick()
    onChange([value])
  }
  return <div className="answers">
    <label className="answer">
      <input type="radio" name={question.id} checked={selected === 'true'} onChange={() => choose('true')} />
      Vrai
    </label>
    <label className="answer">
      <input type="radio" name={question.id} checked={selected === 'false'} onChange={() => choose('false')} />
      Faux
    </label>
  </div>
}
