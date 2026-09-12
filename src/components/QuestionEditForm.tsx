import { useState } from 'react'
import type {
  AnswerOption, BooleanContent, CodeContent, MatchingContent, NumericContent, OrderingContent,
  QCMContent, Question, QuestionType, TextContent, Theme,
} from '../types/quiz'

const toOptionalString = (value: string): string | undefined => (value.trim() === '' ? undefined : value.trim())
const toOptionalNumber = (value: string): number | undefined => (value.trim() === '' ? undefined : Number(value))

/** Squelette vide mais valide (au sens de `parseQuiz`) pour démarrer la création d'une question d'un type donné.
 * Les types à liste ouverte (qcm/code/text/cloze/ordering/matching) démarrent avec quelques entrées vides à
 * compléter — l'admin peut ensuite en ajouter ou en retirer via les éditeurs de contenu ci-dessous. */
function blankContent(type: QuestionType): Question['content'] {
  switch (type) {
    case 'qcm': return { multiple: false, answers: [0, 1, 2, 3].map(() => ({ id: crypto.randomUUID(), label: '', isCorrect: false })) } satisfies QCMContent
    case 'code': return { language: '', snippet: '', answers: [0, 1, 2, 3].map(() => ({ id: crypto.randomUUID(), label: '', isCorrect: false })) } satisfies CodeContent
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

export function createBlankQuestion(type: QuestionType, themeId: string): Question {
  return {
    id: crypto.randomUUID(), type, theme: themeId, difficulty: 'easy', question: type === 'cloze' ? 'Complète : ___' : '',
    tags: [], explanation: '', points: 10, content: blankContent(type),
  } as Question
}

function AnswerOptionsEditor({ answers, onChange }: { answers: AnswerOption[]; onChange: (answers: AnswerOption[]) => void }) {
  const update = (index: number, patch: Partial<AnswerOption>) =>
    onChange(answers.map((answer, i) => (i === index ? { ...answer, ...patch } : answer)))
  const remove = (index: number) => onChange(answers.filter((_, i) => i !== index))
  const add = () => onChange([...answers, { id: crypto.randomUUID(), label: '', isCorrect: false }])
  return <fieldset>
    <legend>Réponses</legend>
    {answers.map((answer, index) => <div className="answer-option-row" key={answer.id}>
      <input type="checkbox" checked={answer.isCorrect} onChange={(event) => update(index, { isCorrect: event.target.checked })} title="Bonne réponse" />
      <input type="text" value={answer.label} onChange={(event) => update(index, { label: event.target.value })} />
      <button type="button" className="secondary" onClick={() => remove(index)} disabled={answers.length <= 1}>🗑️</button>
    </div>)}
    <button type="button" className="secondary" onClick={add}>➕ Ajouter une réponse</button>
  </fieldset>
}

function QCMContentEditor({ content, onChange }: { content: QCMContent; onChange: (content: QCMContent) => void }) {
  return <>
    <label><input type="checkbox" checked={content.multiple} onChange={(event) => onChange({ ...content, multiple: event.target.checked })} /> Plusieurs bonnes réponses possibles</label>
    <AnswerOptionsEditor answers={content.answers} onChange={(answers) => onChange({ ...content, answers })} />
  </>
}

function CodeContentEditor({ content, onChange }: { content: CodeContent; onChange: (content: CodeContent) => void }) {
  return <>
    <label>Langage<input type="text" value={content.language} onChange={(event) => onChange({ ...content, language: event.target.value })} /></label>
    <label>Extrait de code<textarea value={content.snippet} onChange={(event) => onChange({ ...content, snippet: event.target.value })} /></label>
    <AnswerOptionsEditor answers={content.answers} onChange={(answers) => onChange({ ...content, answers })} />
  </>
}

function TextContentEditor({ content, onChange }: { content: TextContent; onChange: (content: TextContent) => void }) {
  const update = (index: number, value: string) =>
    onChange({ ...content, expectedAnswers: content.expectedAnswers.map((answer, i) => (i === index ? value : answer)) })
  const remove = (index: number) => onChange({ ...content, expectedAnswers: content.expectedAnswers.filter((_, i) => i !== index) })
  const add = () => onChange({ ...content, expectedAnswers: [...content.expectedAnswers, ''] })
  return <>
    <fieldset>
      <legend>Réponses attendues</legend>
      {content.expectedAnswers.map((answer, index) => <div className="answer-option-row" key={index}>
        <input type="text" value={answer} onChange={(event) => update(index, event.target.value)} />
        <button type="button" className="secondary" onClick={() => remove(index)} disabled={content.expectedAnswers.length <= 1}>🗑️</button>
      </div>)}
      <button type="button" className="secondary" onClick={add}>➕ Ajouter une réponse</button>
    </fieldset>
    <label><input type="checkbox" checked={content.caseSensitive} onChange={(event) => onChange({ ...content, caseSensitive: event.target.checked })} /> Sensible à la casse</label>
  </>
}

function BooleanContentEditor({ content, onChange }: { content: BooleanContent; onChange: (content: BooleanContent) => void }) {
  return <label>Réponse correcte
    <select value={content.isTrue ? 'true' : 'false'} onChange={(event) => onChange({ isTrue: event.target.value === 'true' })}>
      <option value="true">Vrai</option>
      <option value="false">Faux</option>
    </select>
  </label>
}

function NumericContentEditor({ content, onChange }: { content: NumericContent; onChange: (content: NumericContent) => void }) {
  return <>
    <label>Minimum<input type="number" value={content.min} onChange={(event) => onChange({ ...content, min: Number(event.target.value) })} /></label>
    <label>Maximum<input type="number" value={content.max} onChange={(event) => onChange({ ...content, max: Number(event.target.value) })} /></label>
    <label>Pas<input type="number" value={content.step} onChange={(event) => onChange({ ...content, step: Number(event.target.value) })} /></label>
    <label>Cible<input type="number" value={content.target} onChange={(event) => onChange({ ...content, target: Number(event.target.value) })} /></label>
    <label>Tolérance<input type="number" value={content.tolerance} onChange={(event) => onChange({ ...content, tolerance: Number(event.target.value) })} /></label>
    <label>Unité<input type="text" value={content.unit ?? ''} onChange={(event) => onChange({ ...content, unit: toOptionalString(event.target.value) })} /></label>
  </>
}

function OrderingContentEditor({ content, onChange }: { content: OrderingContent; onChange: (content: OrderingContent) => void }) {
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
      <legend>Libellés</legend>
      {content.items.map((item) => <div className="answer-option-row" key={item.id}>
        <input type="text" value={item.label} onChange={(event) => updateLabel(item.id, event.target.value)} />
        <button type="button" className="secondary" onClick={() => remove(item.id)} disabled={content.items.length <= 2}>🗑️</button>
      </div>)}
      <button type="button" className="secondary" onClick={add}>➕ Ajouter un item</button>
    </fieldset>
    <fieldset>
      <legend>Ordre correct</legend>
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
      <legend>Éléments de gauche</legend>
      {content.left.map((item) => <div className="answer-option-row" key={item.id}>
        <input type="text" value={item.label} onChange={(event) => updateLeftLabel(item.id, event.target.value)} />
        <button type="button" className="secondary" onClick={() => removeLeft(item.id)} disabled={content.left.length <= 1}>🗑️</button>
      </div>)}
      <button type="button" className="secondary" onClick={addLeft}>➕ Ajouter à gauche</button>
    </fieldset>
    <fieldset>
      <legend>Éléments de droite</legend>
      {content.right.map((item) => <div className="answer-option-row" key={item.id}>
        <input type="text" value={item.label} onChange={(event) => updateRightLabel(item.id, event.target.value)} />
        <button type="button" className="secondary" onClick={() => removeRight(item.id)} disabled={content.right.length <= 1}>🗑️</button>
      </div>)}
      <button type="button" className="secondary" onClick={addRight}>➕ Ajouter à droite</button>
    </fieldset>
    <fieldset>
      <legend>Bonnes associations</legend>
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
  const [draft, setDraft] = useState<Question>(question)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try { await onSave(draft) } finally { setSaving(false) }
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
    <label>Énoncé<textarea value={draft.question} onChange={(event) => setDraft({ ...draft, question: event.target.value })} /></label>
    <label>Explication<textarea value={draft.explanation} onChange={(event) => setDraft({ ...draft, explanation: event.target.value })} /></label>
    <label>Thème
      <select value={draft.theme} onChange={(event) => setDraft({ ...draft, theme: event.target.value })}>
        {themes.map((theme) => <option key={theme.id} value={theme.id}>{theme.label}</option>)}
      </select>
    </label>
    <label>Difficulté
      <select value={draft.difficulty} onChange={(event) => setDraft({ ...draft, difficulty: event.target.value as Question['difficulty'] })}>
        <option value="easy">Facile</option>
        <option value="medium">Intermédiaire</option>
        <option value="hard">Difficile</option>
      </select>
    </label>
    <label>Points<input type="number" value={draft.points} onChange={(event) => setDraft({ ...draft, points: Number(event.target.value) })} /></label>
    <label>Tags (séparés par des virgules)
      <input type="text" value={draft.tags.join(', ')} onChange={(event) => setDraft({ ...draft, tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })} />
    </label>
    <label>Image (URL)<input type="text" value={draft.imageUrl ?? ''} onChange={(event) => setDraft({ ...draft, imageUrl: toOptionalString(event.target.value) })} /></label>
    <label>Texte alternatif de l'image<input type="text" value={draft.imageAlt ?? ''} onChange={(event) => setDraft({ ...draft, imageAlt: toOptionalString(event.target.value) })} /></label>
    <label>Diagramme (Mermaid)<textarea value={draft.diagram ?? ''} onChange={(event) => setDraft({ ...draft, diagram: toOptionalString(event.target.value) })} /></label>
    <label>Temps limite (secondes, vide = barème par défaut)
      <input type="number" value={draft.timeLimitSeconds ?? ''} onChange={(event) => setDraft({ ...draft, timeLimitSeconds: toOptionalNumber(event.target.value) })} />
    </label>
    {contentEditor}
    {error && <p className="alert" role="alert">{error}</p>}
    <div className="question-edit-actions">
      <button type="button" onClick={save} disabled={saving}>Enregistrer</button>
      <button type="button" className="secondary" onClick={onCancel} disabled={saving}>Annuler</button>
    </div>
  </div>
}
