import { useState } from 'react'
import { useTranslation } from '../i18n'

interface EditQuizMetaFormProps {
  title: string
  author: string
  description: string
  error: string
  onSave: (title: string, author: string, description: string) => Promise<void>
}

/** Admin uniquement, sur un quiz hébergé actif : modifier titre/auteur/description après coup — jusqu'ici
 * ces informations n'étaient figées qu'au moment de la création du quiz ou d'un import JSON complet. */
export function EditQuizMetaForm({ title, author, description, error, onSave }: EditQuizMetaFormProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [draftTitle, setDraftTitle] = useState(title)
  const [draftAuthor, setDraftAuthor] = useState(author)
  const [draftDescription, setDraftDescription] = useState(description)
  const [saving, setSaving] = useState(false)

  const openForm = () => {
    setDraftTitle(title); setDraftAuthor(author); setDraftDescription(description); setOpen(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      await onSave(draftTitle.trim(), draftAuthor.trim(), draftDescription.trim())
      setOpen(false)
    } catch {
      /* erreur déjà affichée via la prop `error`, formulaire laissé ouvert pour correction */
    } finally {
      setSaving(false)
    }
  }

  if (!open) return <button type="button" className="secondary" onClick={openForm}>{t('admin.editQuizMetaButton')}</button>

  return <div className="question-edit-form">
    <label>{t('admin.titleLabel')}<input type="text" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} /></label>
    <label>{t('admin.authorLabel')}<input type="text" value={draftAuthor} onChange={(event) => setDraftAuthor(event.target.value)} /></label>
    <label>{t('admin.descriptionLabel')}<textarea value={draftDescription} onChange={(event) => setDraftDescription(event.target.value)} /></label>
    {error && <p className="alert" role="alert">{error}</p>}
    <div className="question-edit-actions">
      <button type="button" onClick={save} disabled={saving || !draftTitle.trim() || !draftAuthor.trim()}>{t('common.save')}</button>
      <button type="button" className="secondary" onClick={() => setOpen(false)} disabled={saving}>{t('common.cancel')}</button>
    </div>
  </div>
}
