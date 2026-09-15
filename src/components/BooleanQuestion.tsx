import type { BooleanQuestion as Question, UserAnswer } from '../types/quiz'
import { useTranslation } from '../i18n'
import { playClick } from '../utils/sound'

export function BooleanQuestion({ question, answer, onChange }: { question: Question; answer?: UserAnswer; onChange: (value: string[]) => void }) {
  const { t } = useTranslation()
  const selected = Array.isArray(answer) ? answer[0] : undefined
  const choose = (value: 'true' | 'false') => {
    playClick()
    onChange([value])
  }
  return <div className="answers">
    <label className="answer">
      <input type="radio" name={question.id} checked={selected === 'true'} onChange={() => choose('true')} />
      {t('quiz.true')}
    </label>
    <label className="answer">
      <input type="radio" name={question.id} checked={selected === 'false'} onChange={() => choose('false')} />
      {t('quiz.false')}
    </label>
  </div>
}
