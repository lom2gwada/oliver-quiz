import { useRef } from 'react'
import type { TextQuestion as Question, UserAnswer } from '../types/quiz'
import { useTranslation } from '../i18n'
import { DictationButton } from './DictationButton'

export function TextQuestion({ answer, onChange, onEnter }: { question: Question; answer?: UserAnswer; onChange: (value: string) => void; onEnter?: () => void }) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  return <div className="dictation-row">
    <input ref={inputRef} className="text-answer" type="text" value={typeof answer === 'string' ? answer : ''} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); onEnter?.() } }} placeholder={t('quiz.answerPlaceholder')} autoFocus />
    <DictationButton onResult={(text) => { onChange(text); inputRef.current?.focus() }} />
  </div>
}
