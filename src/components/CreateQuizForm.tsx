import { useState } from 'react'
import { useTranslation } from '../i18n'

interface CreateQuizFormProps {
  error: string
  onCreate: (title: string, author: string, description: string, themeLabels: string[]) => Promise<void>
}

/** Admin uniquement : créer un quiz hébergé de zéro (aucun import JSON requis). Le quiz créé démarre sans
 * questions — l'admin les ajoute ensuite via "➕ Ajouter une question" dans la liste juste en dessous. */
export function CreateQuizForm({ error, onCreate }: CreateQuizFormProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [description, setDescription] = useState('')
  const [themesText, setThemesText] = useState('')
  const [creating, setCreating] = useState(false)

  const reset = () => { setTitle(''); setAuthor(''); setDescription(''); setThemesText(''); setOpen(false) }

  const create = async () => {
    setCreating(true)
    try {
      const themeLabels = themesText.split(',').map((label) => label.trim()).filter(Boolean)
      await onCreate(title.trim(), author.trim(), description.trim(), themeLabels)
      reset()
    } catch {
      /* erreur déjà affichée via la prop `error`, formulaire laissé ouvert pour correction */
    } finally {
      setCreating(false)
    }
  }

  if (!open) return <button type="button" onClick={() => setOpen(true)}>{t('admin.createQuizButton')}</button>

  const themeLabels = themesText.split(',').map((label) => label.trim()).filter(Boolean)
  const canCreate = title.trim() !== '' && author.trim() !== '' && themeLabels.length > 0

  return <div className="question-edit-form">
    <label>{t('admin.titleLabel')}<input type="text" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
    <label>{t('admin.authorLabel')}<input type="text" value={author} onChange={(event) => setAuthor(event.target.value)} /></label>
    <label>{t('admin.descriptionOptionalLabel')}<textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label>
    <label>{t('admin.themesCsvLabel')}
      <input type="text" value={themesText} onChange={(event) => setThemesText(event.target.value)} placeholder={t('admin.themesCsvPlaceholder')} />
    </label>
    {error && <p className="alert" role="alert">{error}</p>}
    <div className="question-edit-actions">
      <button type="button" onClick={create} disabled={creating || !canCreate}>{t('admin.createButton')}</button>
      <button type="button" className="secondary" onClick={reset} disabled={creating}>{t('common.cancel')}</button>
    </div>
  </div>
}
