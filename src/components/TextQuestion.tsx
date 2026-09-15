import type { TextQuestion as Question, UserAnswer } from '../types/quiz'
import { useTranslation } from '../i18n'

export function TextQuestion({ answer, onChange }: { question: Question; answer?: UserAnswer; onChange: (value: string) => void }) {
  const { t } = useTranslation()
  return <input className="text-answer" type="text" value={typeof answer === 'string' ? answer : ''} onChange={(event) => onChange(event.target.value)} placeholder={t('quiz.answerPlaceholder')} autoFocus />
}
