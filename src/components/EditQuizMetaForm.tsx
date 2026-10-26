import { useState } from 'react'
import { useTranslation } from '../i18n'
import type { QuizImage, QuizLink } from '../types/quiz'
import { extrasAreValid, isBlankLink, type LinkDraft, QuizMetaExtrasFields } from './QuizMetaExtrasFields'
import { QuizLanguageField } from './QuizLanguageField'

/** Informations facultatives du quiz saisies avec le reste : image de couverture et liens « Pour aller plus loin ». */
export interface QuizMetaExtras {
  image?: QuizImage
  links?: QuizLink[]
}

interface EditQuizMetaFormProps {
  title: string
  author: string
  description: string
  language: string
  image: QuizImage | undefined
  links: QuizLink[] | undefined
  error: string
  onSave: (title: string, author: string, description: string, language: string, extras: QuizMetaExtras) => Promise<void>
}

const toDrafts = (links: QuizLink[] | undefined): LinkDraft[] => (links ?? []).map((link) => ({ label: link.label, url: link.url, commercial: Boolean(link.commercial) }))

/** Admin uniquement, sur un quiz hébergé actif : modifier titre/auteur/description, langue, image de couverture et
 * liens après coup — jusqu'ici ces informations n'étaient figées qu'au moment de la création du quiz ou d'un import
 * JSON complet. */
export function EditQuizMetaForm({ title, author, description, language, image, links, error, onSave }: EditQuizMetaFormProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [draftTitle, setDraftTitle] = useState(title)
  const [draftAuthor, setDraftAuthor] = useState(author)
  const [draftDescription, setDraftDescription] = useState(description)
  const [draftLanguage, setDraftLanguage] = useState<string>(language)
  const [draftImageUrl, setDraftImageUrl] = useState(image?.url ?? '')
  const [draftImageAlt, setDraftImageAlt] = useState(image?.alt ?? '')
  const [draftLinks, setDraftLinks] = useState<LinkDraft[]>(toDrafts(links))
  const [saving, setSaving] = useState(false)

  const openForm = () => {
    setDraftTitle(title); setDraftAuthor(author); setDraftDescription(description); setDraftLanguage(language)
    setDraftImageUrl(image?.url ?? ''); setDraftImageAlt(image?.alt ?? ''); setDraftLinks(toDrafts(links))
    setOpen(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      const keptLinks = draftLinks.filter((link) => !isBlankLink(link)).map((link): QuizLink => ({ label: link.label.trim(), url: link.url.trim(), ...(link.commercial && { commercial: true }) }))
      const extras: QuizMetaExtras = {
        image: draftImageUrl.trim() ? { url: draftImageUrl.trim(), alt: draftImageAlt.trim() } : undefined,
        links: keptLinks.length ? keptLinks : undefined,
      }
      await onSave(draftTitle.trim(), draftAuthor.trim(), draftDescription.trim(), draftLanguage, extras)
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
    <QuizLanguageField value={draftLanguage} onChange={setDraftLanguage} />
    <QuizMetaExtrasFields imageUrl={draftImageUrl} imageAlt={draftImageAlt} links={draftLinks} onImageUrlChange={setDraftImageUrl} onImageAltChange={setDraftImageAlt} onLinksChange={setDraftLinks} />
    {error && <p className="alert" role="alert">{error}</p>}
    <div className="question-edit-actions">
      <button type="button" onClick={save} disabled={saving || !draftTitle.trim() || !draftAuthor.trim() || !extrasAreValid(draftImageUrl, draftImageAlt, draftLinks)}>{t('common.save')}</button>
      <button type="button" className="secondary" onClick={() => setOpen(false)} disabled={saving}>{t('common.cancel')}</button>
    </div>
  </div>
}
