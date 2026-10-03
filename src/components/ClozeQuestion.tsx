import { useRef } from 'react'
import type { ClozeQuestion as Question, UserAnswer } from '../types/quiz'
import { useTranslation } from '../i18n'
import { DictationButton } from './DictationButton'

const BLANK = /_{3,}/

export function ClozeQuestion({ question, answer, onChange, onEnter }: { question: Question; answer?: UserAnswer; onChange: (value: string) => void; onEnter?: () => void }) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const match = question.question.match(BLANK)
  const splitIndex = match?.index ?? question.question.length
  const before = question.question.slice(0, splitIndex)
  const after = question.question.slice(splitIndex + (match?.[0].length ?? 0))
  return <>
    <h2 className="cloze">
      {before}
      <input ref={inputRef} className="cloze-input" type="text" value={typeof answer === 'string' ? answer : ''} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); onEnter?.() } }} aria-label={t('quiz.answerAriaLabel')} autoFocus />
      {after}
    </h2>
    <div className="dictation-row">
      <DictationButton onResult={(text) => { onChange(text); inputRef.current?.focus() }} />
    </div>
  </>
}
