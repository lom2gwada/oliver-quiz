import { useState } from 'react'
import type {
  AnswerOption, BooleanContent, CodeContent, MatchingContent, NumericContent, OrderingContent,
  QCMContent, Question, QuestionType, TextContent, Theme,
} from '../types/quiz'
import { useTranslation } from '../i18n'

const toOptionalString = (value: string): string | undefined => (value.trim() === '' ? undefined : value.trim())
const toOptionalNumber = (value: string): number | undefined => (value.trim() === '' ? undefined : Number(value))

/** Squelette vide mais valide (au sens de `parseQuiz`) pour démarrer la création d'une question d'un type donné.
 * Les types à liste ouverte (qcm/code/text/cloze/ordering/matching) démarrent avec quelques entrées vides à
 * compléter — l'admin peut ensuite en ajouter ou en retirer via les éditeurs de contenu ci-dessous. */
function blankContent(type: QuestionType): Question['content'] {
  switch (type) {
    case 'qcm': return { multiple: false, answers: [0, 1, 2, 3].map(() => ({ id: crypto.randomUUID(), label: '', isCorrect: false })) } satisfies QCMContent
    case 'code': return { language: '', snippet: '', multiple: false, answers: [0, 1, 2, 3].map(() => ({ id: crypto.randomUUID(), label: '', isCorrect: false })) } satisfies CodeContent
    case 'text': return { expectedAnswers: [''], caseSensitive: false } satisfies TextContent
    case 'cloze': return { expectedAnswers: [''], caseSensitive: false } satisfies TextContent
    case 'boolean': return { isTrue: true } satisfies BooleanContent
    case 'numeric': return { min: 0, max: 10, step: 1, target: 5, tolerance: 1 } satisfies NumericContent
    case 'ordering': {
      const items = [0, 1, 2].map(() => ({ id: crypto.randomUUID(), label: '' }))
      return { items, correctOrder: items.map((item) => item.id) } satisfies OrderingContent
    }
    case 'matching': {
      const left = [0, 1].map(() => ({ id: crypto.randomUUID(), label: '' }))
      const right = [0, 1].map(() => ({ id: crypto.randomUUID(), label: '' }))
      return { left, right, correctPairs: Object.fromEntries(left.map((item, index) => [item.id, right[index].id])) } satisfies MatchingContent
    }
  }
}

export function createBlankQuestion(type: QuestionType, themeId: string, clozeSeedText = 'Complète : ___'): Question {
  return {
    id: crypto.randomUUID(), type, theme: themeId, difficulty: 'easy', question: type === 'cloze' ? clozeSeedText : '',
    tags: [], explanation: '', points: 10, content: blankContent(type),
  } as Question
}

function AnswerOptionsEditor({ answers, onChange }: { answers: AnswerOption[]; onChange: (answers: AnswerOption[]) => void }) {
  const { t } = useTranslation()
  const update = (index: number, patch: Partial<AnswerOption>) =>
    onChange(answers.map((answer, i) => (i === index ? { ...answer, ...patch } : answer)))
  const remove = (index: number) => onChange(answers.filter((_, i) => i !== index))
  const add = () => onChange([...answers, { id: crypto.randomUUID(), label: '', isCorrect: false }])
  return <fieldset>
    <legend>{t('admin.answersLegend')}</legend>
    {answers.map((answer, index) => <div className="answer-option-row" key={answer.id}>
      <input type="checkbox" checked={answer.isCorrect} onChange={(event) => update(index, { isCorrect: event.target.checked })} title={t('admin.correctAnswerTitle')} />
      <input type="text" value={answer.label} onChange={(event) => update(index, { label: event.target.value })} />
      <button type="button" className="secondary" onClick={() => remove(index)} disabled={answers.length <= 1}>🗑️</button>
    </div>)}
    <button type="button" className="secondary" onClick={add}>{t('admin.addAnswerButton')}</button>
  </fieldset>
}

function QCMContentEditor({ content, onChange }: { content: QCMContent; onChange: (content: QCMContent) => void }) {
  const { t } = useTranslation()
  return <>
    <label className="checkbox-field"><input type="checkbox" checked={content.multiple} onChange={(event) => onChange({ ...content, multiple: event.target.checked })} /> {t('admin.multipleAnswersLabel')}</label>
    <AnswerOptionsEditor answers={content.answers} onChange={(answers) => onChange({ ...content, answers })} />
  </>
}

function CodeContentEditor({ content, onChange }: { content: CodeContent; onChange: (content: CodeContent) => void }) {
  const { t } = useTranslation()
  return <>
    <label>{t('admin.languageLabel')}<input type="text" value={content.language} onChange={(event) => onChange({ ...content, language: event.target.value })} /></label>
    <label>{t('admin.codeSnippetLabel')}<textarea value={content.snippet} onChange={(event) => onChange({ ...content, snippet: event.target.value })} /></label>
    <label className="checkbox-field"><input type="checkbox" checked={content.multiple} onChange={(event) => onChange({ ...content, multiple: event.target.checked })} /> {t('admin.multipleAnswersLabel')}</label>
    <AnswerOptionsEditor answers={content.answers} onChange={(answers) => onChange({ ...content, answers })} />
  </>
}

function TextContentEditor({ content, onChange }: { content: TextContent; onChange: (content: TextContent) => void }) {
  const { t } = useTranslation()
  const update = (index: number, value: string) =>
    onChange({ ...content, expectedAnswers: content.expectedAnswers.map((answer, i) => (i === index ? value : answer)) })
  const remove = (index: number) => onChange({ ...content, expectedAnswers: content.expectedAnswers.filter((_, i) => i !== index) })
  const add = () => onChange({ ...content, expectedAnswers: [...content.expectedAnswers, ''] })
  return <>
    <fieldset>
      <legend>{t('admin.expectedAnswersLegend')}</legend>
      {content.expectedAnswers.map((answer, index) => <div className="answer-option-row" key={index}>
        <input type="text" value={answer} onChange={(event) => update(index, event.target.value)} />
        <button type="button" className="secondary" onClick={() => remove(index)} disabled={content.expectedAnswers.length <= 1}>🗑️</button>
      </div>)}
      <button type="button" className="secondary" onClick={add}>{t('admin.addAnswerButton')}</button>
    </fieldset>
    <label className="checkbox-field"><input type="checkbox" checked={content.caseSensitive} onChange={(event) => onChange({ ...content, caseSensitive: event.target.checked })} /> {t('admin.caseSensitiveLabel')}</label>
  </>
}

function BooleanContentEditor({ content, onChange }: { content: BooleanContent; onChange: (content: BooleanContent) => void }) {
  const { t } = useTranslation()
  return <label>{t('admin.correctAnswerSelectLabel')}
    <select value={content.isTrue ? 'true' : 'false'} onChange={(event) => onChange({ isTrue: event.target.value === 'true' })}>
      <option value="true">{t('quiz.true')}</option>
      <option value="false">{t('quiz.false')}</option>
    </select>
  </label>
}

function NumericContentEditor({ content, onChange }: { content: NumericContent; onChange: (content: NumericContent) => void }) {
  const { t } = useTranslation()
  return <>
    <label>{t('admin.minLabel')}<input type="number" value={content.min} onChange={(event) => onChange({ ...content, min: Number(event.target.value) })} /></label>
    <label>{t('admin.maxLabel')}<input type="number" value={content.max} onChange={(event) => onChange({ ...content, max: Number(event.target.value) })} /></label>
    <label>{t('admin.stepLabel')}<input type="number" value={content.step} onChange={(event) => onChange({ ...content, step: Number(event.target.value) })} /></label>
    <label>{t('admin.targetLabel')}<input type="number" value={content.target} onChange={(event) => onChange({ ...content, target: Number(event.target.value) })} /></label>
    <label>{t('admin.toleranceLabel')}<input type="number" value={content.tolerance} onChange={(event) => onChange({ ...content, tolerance: Number(event.target.value) })} /></label>
    <label>{t('admin.unitLabel')}<input type="text" value={content.unit ?? ''} onChange={(event) => onChange({ ...content, unit: toOptionalString(event.target.value) })} /></label>
  </>
}

function OrderingContentEditor({ content, onChange }: { content: OrderingContent; onChange: (content: OrderingContent) => void }) {
  const { t } = useTranslation()
  const updateLabel = (id: string, label: string) =>
    onChange({ ...content, items: content.items.map((item) => (item.id === id ? { ...item, label } : item)) })
  const move = (index: number, direction: -1 | 1) => {
    const next = [...content.correctOrder]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange({ ...content, correctOrder: next })
  }
  const remove = (id: string) => onChange({ items: content.items.filter((item) => item.id !== id), correctOrder: content.correctOrder.filter((orderId) => orderId !== id) })
  const add = () => {
    const item = { id: crypto.randomUUID(), label: '' }
    onChange({ items: [...content.items, item], correctOrder: [...content.correctOrder, item.id] })
  }
  const labelOf = (id: string) => content.items.find((item) => item.id === id)?.label ?? id
  return <>
    <fieldset>
      <legend>{t('admin.labelsLegend')}</legend>
      {content.items.map((item) => <div className="answer-option-row" key={item.id}>
        <input type="text" value={item.label} onChange={(event) => updateLabel(item.id, event.target.value)} />
        <button type="button" className="secondary" onClick={() => remove(item.id)} disabled={content.items.length <= 2}>🗑️</button>
      </div>)}
      <button type="button" className="secondary" onClick={add}>{t('admin.addItemButton')}</button>
    </fieldset>
    <fieldset>
      <legend>{t('admin.correctOrderLegend')}</legend>
      {content.correctOrder.map((id, index) => <div className="reorder-row" key={id}>
        <span>{index + 1}. {labelOf(id)}</span>
        <div className="reorder-controls">
          <button type="button" className="secondary" onClick={() => move(index, -1)} disabled={index === 0}>↑</button>
          <button type="button" className="secondary" onClick={() => move(index, 1)} disabled={index === content.correctOrder.length - 1}>↓</button>
        </div>
      </div>)}
    </fieldset>
  </>
}

function MatchingContentEditor({ content, onChange }: { content: MatchingContent; onChange: (content: MatchingContent) => void }) {
  const { t } = useTranslation()
  const updateLeftLabel = (id: string, label: string) => onChange({ ...content, left: content.left.map((item) => (item.id === id ? { ...item, label } : item)) })
  const updateRightLabel = (id: string, label: string) => onChange({ ...content, right: content.right.map((item) => (item.id === id ? { ...item, label } : item)) })
  const updatePair = (leftId: string, rightId: string) => onChange({ ...content, correctPairs: { ...content.correctPairs, [leftId]: rightId } })
  const addLeft = () => {
    const item = { id: crypto.randomUUID(), label: '' }
    onChange({ ...content, left: [...content.left, item], correctPairs: { ...content.correctPairs, [item.id]: content.right[0].id } })
  }
  const removeLeft = (id: string) => {
    const { [id]: _removed, ...correctPairs } = content.correctPairs
    onChange({ ...content, left: content.left.filter((item) => item.id !== id), correctPairs })
  }
  const addRight = () => onChange({ ...content, right: [...content.right, { id: crypto.randomUUID(), label: '' }] })
  const removeRight = (id: string) => {
    const right = content.right.filter((item) => item.id !== id)
    const correctPairs = Object.fromEntries(Object.entries(content.correctPairs).map(([leftId, rightId]) => [leftId, rightId === id ? right[0].id : rightId]))
    onChange({ ...content, right, correctPairs })
  }
  return <>
    <fieldset>
      <legend>{t('admin.leftItemsLegend')}</legend>
      {content.left.map((item) => <div className="answer-option-row" key={item.id}>
        <input type="text" value={item.label} onChange={(event) => updateLeftLabel(item.id, event.target.value)} />
        <button type="button" className="secondary" onClick={() => removeLeft(item.id)} disabled={content.left.length <= 1}>🗑️</button>
      </div>)}
      <button type="button" className="secondary" onClick={addLeft}>{t('admin.addLeftButton')}</button>
    </fieldset>
    <fieldset>
      <legend>{t('admin.rightItemsLegend')}</legend>
      {content.right.map((item) => <div className="answer-option-row" key={item.id}>
        <input type="text" value={item.label} onChange={(event) => updateRightLabel(item.id, event.target.value)} />
        <button type="button" className="secondary" onClick={() => removeRight(item.id)} disabled={content.right.length <= 1}>🗑️</button>
      </div>)}
      <button type="button" className="secondary" onClick={addRight}>{t('admin.addRightButton')}</button>
    </fieldset>
    <fieldset>
      <legend>{t('admin.correctPairsLegend')}</legend>
      {content.left.map((item) => <label key={item.id}>{item.label}
        <select value={content.correctPairs[item.id] ?? ''} onChange={(event) => updatePair(item.id, event.target.value)}>
          {content.right.map((right) => <option key={right.id} value={right.id}>{right.label}</option>)}
        </select>
      </label>)}
    </fieldset>
  </>
}

interface QuestionEditFormProps {
  question: Question
  themes: Theme[]
  error: string
  onSave: (updated: Question) => Promise<void>
  onCancel: () => void
}

export function QuestionEditForm({ question, themes, error, onSave, onCancel }: QuestionEditFormProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<Question>(question)
  // Texte brut séparé de `draft.tags` : si l'input était contrôlé directement par `draft.tags.join(', ')`,
  // taper une virgule la ferait aussitôt disparaître (split → filtre des entrées vides → rejoin sans la virgule
  // en cours de frappe). On ne recalcule la liste de tags qu'à l'enregistrement.
  const [tagsText, setTagsText] = useState(question.tags.join(', '))
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const tags = tagsText.split(',').map((tag) => tag.trim()).filter(Boolean)
      await onSave({ ...draft, tags })
    } finally {
      setSaving(false)
    }
  }

  const contentEditor = (() => {
    switch (draft.type) {
      case 'qcm': return <QCMContentEditor content={draft.content} onChange={(content) => setDraft({ ...draft, content })} />
      case 'code': return <CodeContentEditor content={draft.content} onChange={(content) => setDraft({ ...draft, content })} />
      case 'text': return <TextContentEditor content={draft.content} onChange={(content) => setDraft({ ...draft, content })} />
      case 'cloze': return <TextContentEditor content={draft.content} onChange={(content) => setDraft({ ...draft, content })} />
      case 'boolean': return <BooleanContentEditor content={draft.content} onChange={(content) => setDraft({ ...draft, content })} />
      case 'numeric': return <NumericContentEditor content={draft.content} onChange={(content) => setDraft({ ...draft, content })} />
      case 'ordering': return <OrderingContentEditor content={draft.content} onChange={(content) => setDraft({ ...draft, content })} />
      case 'matching': return <MatchingContentEditor content={draft.content} onChange={(content) => setDraft({ ...draft, content })} />
    }
  })()

  return <div className="question-edit-form">
    <label>{t('admin.promptLabel')}<textarea value={draft.question} onChange={(event) => setDraft({ ...draft, question: event.target.value })} /></label>
    <label>{t('admin.explanationLabel')}<textarea value={draft.explanation} onChange={(event) => setDraft({ ...draft, explanation: event.target.value })} /></label>
    <label>{t('admin.quizThemeLabel')}
      <select value={draft.theme} onChange={(event) => setDraft({ ...draft, theme: event.target.value })}>
        {themes.map((theme) => <option key={theme.id} value={theme.id}>{theme.label}</option>)}
      </select>
    </label>
    <label>{t('filter.difficultyLabel')}
      <select value={draft.difficulty} onChange={(event) => setDraft({ ...draft, difficulty: event.target.value as Question['difficulty'] })}>
        <option value="easy">{t('quiz.difficultyEasy')}</option>
        <option value="medium">{t('quiz.difficultyMedium')}</option>
        <option value="hard">{t('quiz.difficultyHard')}</option>
      </select>
    </label>
    <label>{t('admin.pointsFieldLabel')}<input type="number" value={draft.points} onChange={(event) => setDraft({ ...draft, points: Number(event.target.value) })} /></label>
    <label>{t('admin.tagsLabel')}
      <input type="text" value={tagsText} onChange={(event) => setTagsText(event.target.value)} />
    </label>
    <label>{t('admin.imageUrlLabel')}<input type="text" value={draft.imageUrl ?? ''} onChange={(event) => setDraft({ ...draft, imageUrl: toOptionalString(event.target.value) })} /></label>
    <label>{t('admin.imageAltLabel')}<input type="text" value={draft.imageAlt ?? ''} onChange={(event) => setDraft({ ...draft, imageAlt: toOptionalString(event.target.value) })} /></label>
    <label>{t('admin.diagramLabel')}<textarea value={draft.diagram ?? ''} onChange={(event) => setDraft({ ...draft, diagram: toOptionalString(event.target.value) })} /></label>
    <label>{t('admin.timeLimitLabel')}
      <input type="number" value={draft.timeLimitSeconds ?? ''} onChange={(event) => setDraft({ ...draft, timeLimitSeconds: toOptionalNumber(event.target.value) })} />
    </label>
    {contentEditor}
    {error && <p className="alert" role="alert">{error}</p>}
    <div className="question-edit-actions">
      <button type="button" onClick={save} disabled={saving}>{t('common.save')}</button>
      <button type="button" className="secondary" onClick={onCancel} disabled={saving}>{t('common.cancel')}</button>
    </div>
  </div>
}
